'use strict';

/* eslint-disable id-length */
/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */

/* eslint-disable no-unused-vars */
const SET_DISPLAY_START_LINE           = 0x40;
const DISPLAY_OFF                      = 0xAE;
const DISPLAY_ON                       = 0xAF;
const SET_ENTIRE_DISPLAY_OFF           = 0xA4;
const SET_ENTIRE_DISPLAY_ON            = 0xA5;
const SET_MULTIPLEX_RATIO              = 0xA8;
const SET_DISPLAY_OFFSET               = 0xD3;
const SET_DISPLAY_CLOCK_DIVIDE         = 0xD5;
const SET_DC_DC_CONTROL_MODE           = 0xAD;
const SET_DC_DC_ENABLE                 = 0x8B;
const SET_PRE_CHARGE_PERIOD            = 0xD9;
const SET_VCOMH                        = 0xDB;
const SET_PUMP_VOLTAGE                 = 0x32;
const SET_CONTRAST_CTRL_MODE           = 0x81;
const SET_NORMAL_DISPLAY               = 0xA6;
const SET_REVERSE_DISPLAY              = 0xA7;
const SET_COMMON_PADS_HARDWARE_MODE    = 0xDA;
const SET_SEGMENT_REMAP                = 0xA1;
const SET_COMMON_OUTPUT_SCAN_DIRECTION = 0xC8;
const SET_PAGE_ADDRESS                 = 0xB0; /* sets the page address from 0 to 7 */
/* eslint-enable no-unused-vars */

class Oled {
  constructor(opts) {
    opts = opts || {};

    this.HEIGHT         = opts.height || 64;
    this.WIDTH          = opts.width || 128;
    this.DATA_SIZE      = opts.dataSize || 16;
    this.MAX_PAGE_COUNT = opts.maxPageCount || 8;

    // new blank buffer
    // init with 0xff to make sure that the inital clearDisplay() call will update all pixels.
    this.buffer     = Buffer.alloc((this.WIDTH * this.HEIGHT) / 8, 0xff);
    this.dirtyBytes = [];

    if(!opts.rpio) {
      throw new Error('new Oled(): rpio missing');
    }

    // setup i2c
    this.rpio = opts.rpio;

    this.rpio.i2cBegin();
    this.rpio.i2cSetSlaveAddress(opts.address || 0x3C);
    this.rpio.i2cSetBaudRate(1800000);
  }

  async initialize() {
    // sequence of bytes to initialize with
    const initSeq = [
      DISPLAY_OFF,
      SET_ENTIRE_DISPLAY_OFF,
      SET_DISPLAY_CLOCK_DIVIDE, 0x50,
      SET_MULTIPLEX_RATIO, 0x3F,
      SET_DISPLAY_OFFSET, 0x00,
      SET_DISPLAY_START_LINE,
      SET_DC_DC_CONTROL_MODE,
      SET_DC_DC_ENABLE,
      SET_PRE_CHARGE_PERIOD, 0x22,
      SET_VCOMH, 0x35,
      SET_PUMP_VOLTAGE,
      SET_CONTRAST_CTRL_MODE, 0xFF,
      SET_NORMAL_DISPLAY,
      SET_COMMON_PADS_HARDWARE_MODE, 0x12,
      SET_SEGMENT_REMAP,
      SET_COMMON_OUTPUT_SCAN_DIRECTION,
      DISPLAY_ON,
    ];

    // write init seq commands
    await this._transferCmd(initSeq);
    await this.clearDisplay(true);
  }

  async _transferCmd(cmds) {
    if(typeof cmds === 'number') {
      cmds = [cmds];
    }

    cmds.map(async cmd => {
      this.rpio.i2cWrite(Buffer.from([0x00, cmd]));
    });
  }

  async _transferData(data) {
    for(let i = 0; i < data.length; i += this.DATA_SIZE) {
      const slice = data.slice(i, i + this.DATA_SIZE);
      const transfer = Buffer.allocUnsafe(slice.length + 1);

      transfer[0] = 0x40;
      slice.copy(transfer, 1);
      this.rpio.i2cWrite(transfer);
    }
  }

  // write text to the oled
  async writeString(x, y, font, string, color, sync = true) {
    // start x offset
    let   offset   = x;
    let   padding  = 0;
    const letspace = 1;

    // loop through string
    const stringArr = string.split('');

    // loop through the array of each char to draw
    for(let i = 0; i < stringArr.length; i += 1) {
      if(offset < this.WIDTH) {
        // draw the entire character
        this._drawChar(offset, y, font, stringArr[i], color);
      }

      // calc new x position for the next char, add a touch of padding too if it's a non space char
      padding = stringArr[i] === ' ' ? 0 : letspace;
      offset += font.width + padding;
    }

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // draw an individual character to the screen
  _drawChar(x, y, font, char, color) {
    // look up the position of the char, pull out the buffer slice
    const charBuf = this._findCharBuf(font, char);
    // read the bits in the bytes that make up the char
    const byteArray = this._readCharBytes(charBuf);

    let pagePos;
    let c = 0;

    // loop through the byte array containing the hexes for the char
    for(let i = 0; i < byteArray.length; i++) {
      pagePos = Math.floor(i / font.width) * 8;
      for(let j = 0; j < 8; j++) {
        if(j + pagePos === font.height) {
          break;
        }

        // pull color out
        let setColor = byteArray[i][j];

        if(color === 'BLACK' || !color) {
          setColor = !setColor;
        }

        const xpos = x + c;
        const ypos = y + j + pagePos;

        this.drawPixel([xpos, ypos, setColor], false);
      }
      if(c < font.width - 1) {
        c++;
      } else {
        c = 0;
      }
    }
  }

  // get character bytes from the supplied font object in order to send to framebuffer
  _readCharBytes(byteArray) {
    let   bitArr     = [];
    const bitCharArr = [];

    // loop through each byte supplied for a char
    for(let i = 0; i < byteArray.length; i += 1) {
      // set current byte
      const byte = byteArray[i];

      // read each byte
      for(let j = 0; j < 8; j += 1) {
        // shift bits right until all are read
        const bit = byte >> j & 1;

        bitArr.push(bit);
      }

      // push to array containing flattened bit sequence
      bitCharArr.push(bitArr);
      // clear bits for next byte
      bitArr = [];
    }

    return bitCharArr;
  }

  // find where the character exists within the font object
  _findCharBuf(font, c) {
    const charLength = font.width * Math.ceil(font.height / 8);
    // use the lookup array as a ref to find where the current char bytes start
    const cBufPos = font.lookup.indexOf(c) * charLength;
    // slice just the current char's bytes out of the fontData array and return
    const cBuf = font.fontData.slice(cBufPos, cBufPos + charLength);

    return cBuf;
  }

  // send the entire framebuffer to the oled
  async update(startPage = 0, endPage = this.MAX_PAGE_COUNT - 1) {
    for(let index = startPage; index <= endPage; index++) {
      const displaySeq = [
        SET_PAGE_ADDRESS + index,
        0x00, // low column start address
        0x10, // high column start address
      ];

      // send intro seq
      await this._transferCmd(displaySeq);

      // write buffer data
      const start = index * this.WIDTH;
      const end   = start + this.WIDTH;
      const slice = this.buffer.slice(start, end);

      await this._transferData(Buffer.from([0x00, 0x00])); // there are two pixels per page, not shown
      await this._transferData(slice);
    }

    // now that all bytes are synced, reset dirty state
    this.dirtyBytes = [];
  }

  // send dim display command to oled
  async dimDisplay(contrast) {
    if(typeof dim === 'boolean') {
      if(contrast) {
        contrast = 0x00; // Dimmed display
      } else {
        contrast = 0xff; // Bright display
      }
    }

    await this._transferCmd([SET_CONTRAST_CTRL_MODE, contrast]);
  }

  // turn oled off
  async turnOffDisplay() {
    await this._transferCmd(DISPLAY_OFF);
  }

  // turn oled on
  async turnOnDisplay() {
    await this._transferCmd(DISPLAY_ON);
  }

  // clear all pixels currently on the display
  async clearDisplay(sync = true) {
    // write off pixels
    // this.buffer.fill(0x00);
    for(let i = 0; i < this.buffer.length; i += 1) {
      if(this.buffer[i] !== 0x00) {
        this.buffer[i] = 0x00;
        if(this.dirtyBytes.indexOf(i) === -1) {
          this.dirtyBytes.push(i);
        }
      }
    }
    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // invert pixels on oled
  async invertDisplay(invert) {
    if(invert) {
      await this._transferCmd(SET_REVERSE_DISPLAY); // inverted
    } else {
      await this._transferCmd(SET_NORMAL_DISPLAY); // non inverted
    }
  }

  // draw an image pixel array on the screen
  async drawBitmap(pixels, sync = true) {
    let   x;
    let   y;

    for(let i = 0; i < pixels.length; i++) {
      x = Math.floor(i % this.WIDTH);
      y = Math.floor(i / this.WIDTH);

      this.drawPixel([x, y, pixels[i]], false);
    }

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // draw one or many pixels on oled
  async drawPixel(pixels, sync = true) {
    // handle lazy single pixel case
    if(typeof pixels[0] !== 'object') {
      pixels = [pixels];
    }

    pixels.forEach(function(el) {
      // return if the pixel is out of range
      const x = el[0];
      const y = el[1];
      const color = el[2];

      if(x < 0 || x >= this.WIDTH || y < 0 || y >= this.HEIGHT) {
        return;
      }

      // thanks, Martin Richards.
      // I wanna can this, this tool is for devs who get 0 indexes
      // x -= 1; y -=1;
      let   byte = 0;
      const page = Math.floor(y / 8);
      const pageShift = 0x01 << (y - 8 * page);

      // is the pixel on the first row of the page?
      if(page === 0) {
        byte = x;
      } else {
        byte = x + (this.WIDTH * page);
      }

      // colors! Well, monochrome.
      if(color === 'BLACK' || !color) {
        this.buffer[byte] &= ~pageShift;
      } else if(color === 'WHITE' || color) {
        this.buffer[byte] |= pageShift;
      }

      // push byte to dirty if not already there
      if(this.dirtyBytes.indexOf(byte) === -1) {
        this.dirtyBytes.push(byte);
      }
    }, this);

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // looks at dirty bytes, and sends the updated bytes to the display
  async _updateDirtyBytes(byteArray) {
    const blen = byteArray.length;
    let   pageStart = Infinity;
    let   pageEnd = 0;
    let   any = false;

    // iterate through dirty bytes
    for(let i = 0; i < blen; i += 1) {
      const b = byteArray[i];

      if(b >= 0 && b < this.buffer.length) {
        const page = b / this.WIDTH | 0;

        if(page < pageStart) {
          pageStart = page;
        }
        if(page > pageEnd) {
          pageEnd = page;
        }
        any = true;
      }
    }

    // TODO ?? I could re-add the logic to calculate the number of bytes per row
    // that need to be written.

    if(!any) {
      return;
    }

    await this.update(pageStart, pageEnd);

    // now that all bytes are synced, reset dirty state
    this.dirtyBytes = [];
  }

  // using Bresenham's line algorithm
  async drawDashedLine(x0, y0, x1, y1, initialColor, interval, sync = true) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let   err = (dx > dy ? dx : -dy) / 2;
    let   color      = initialColor;
    let   colorCount = 0;

    /* eslint-disable no-constant-condition */
    while(true) {
      colorCount++;
      if(colorCount === interval) {
        if(color === 'BLACK') {
          color = 'WHITE';
        } else {
          color = 'BLACK';
        }
        colorCount = 0;
      }

      this.drawPixel([x0, y0, color], false);

      if(x0 === x1 && y0 === y1) {
        break;
      }

      const e2 = err;

      if(e2 > -dx) {
        err -= dy;
        x0 += sx;
      }
      if(e2 < dy) {
        err += dx;
        y0 += sy;
      }
    }
    /* eslint-enable no-constant-condition */

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  async drawLine(x0, y0, x1, y1, color, sync = true) {
    await this.drawDashedLine(x0, y0, x1, y1, color, 0, sync);
  }

  // Draw an outlined rectangle
  async drawDashedRect(x, y, w, h, color, interval, sync = true) {
    const x2 = x + w - 1;
    const y2 = y + h - 1;

    // top
    this.drawDashedLine(x,  y, x2,  y, color, interval, false);

    // left
    this.drawDashedLine(x,  y,  x, y2, color, interval, false);

    // right
    this.drawDashedLine(x2, y, x2, y2, color, interval, false);

    // bottom
    this.drawDashedLine(x, y2, x2, y2, color, interval, false);

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  async drawRect(x, y, w, h, color, sync = true) {
    await this.drawDashedRect(x, y, w, h, color, 0, sync);
  }

  // draw a filled rectangle on the oled
  async fillDashedRect(x, y, w, h, initialColor, interval, sync = true) {
    const x2 = x + w - 1;
    const y2 = y + h - 1;
    let   color      = initialColor;
    let   colorCount = 0;

    // one iteration for each column of the rectangle
    for(let i = x; i <= x2; i++) {
      colorCount++;
      if(colorCount === interval) {
        if(color === 'BLACK') {
          color = 'WHITE';
        } else {
          color = 'BLACK';
        }
        colorCount = 0;
      }

      // draws a vert line
      this.drawDashedLine(i, y, i, y2, color, interval, false);
    }

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  async fillRect(x, y, w, h, color, sync = true) {
    await this.fillDashedRect(x, y, w, h, color, 0, sync);
  }

  /**
   * Draw a circle outline
   *
   * This method is ad verbatim translation from the corresponding
   * method on the Adafruit GFX library
   * https://github.com/adafruit/Adafruit-GFX-Library
   */
  async drawCircle(x0, y0, r, color, sync = true) {
    let   f = 1 - r;
    let   ddFX = 1;
    let   ddFY = -2 * r;
    let   x = 0;
    let   y = r;

    this.drawPixel(
      [[x0, y0 + r, color],
        [x0, y0 - r, color],
        [x0 + r, y0, color],
        [x0 - r, y0, color]],
      false
    );

    while(x < y) {
      if(f >= 0) {
        y--;
        ddFY += 2;
        f += ddFY;
      }
      x++;
      ddFX += 2;
      f += ddFX;

      this.drawPixel(
        [[x0 + x, y0 + y, color],
          [x0 - x, y0 + y, color],
          [x0 + x, y0 - y, color],
          [x0 - x, y0 - y, color],
          [x0 + y, y0 + x, color],
          [x0 - y, y0 + x, color],
          [x0 + y, y0 - x, color],
          [x0 - y, y0 - x, color]],
        false
      );
    }

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }
}

module.exports = Oled;
