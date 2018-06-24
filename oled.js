'use strict';

/* eslint-disable id-length */
/* eslint-disable no-bitwise */
/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */ // TODO

const I2c = require('i2c');

/* eslint-disable no-unused-vars */
const HEIGHT         = 64;
const WIDTH          = 128;
const DATA_SIZE      = 16;
const MAX_PAGE_COUNT = 8;

const SET_PAGE_ADDRESS              = 0xB0; /* sets the page address from 0 to 7 */
const DISPLAY_OFF                   = 0xAE;
const DISPLAY_ON                    = 0xAF;
const SET_MEMORY_ADDRESSING_MODE    = 0x20;
const SET_COM_OUTPUT_SCAN_DIRECTION = 0xC8;
const LOW_COLUMN_ADDRESS            = 0x00;
const HIGH_COLUMN_ADDRESS           = 0x10;
const START_LINE_ADDRESS            = 0x40;
const SET_CONTRAST_CTRL_REG         = 0x81;
const SET_SEGMENT_REMAP             = 0xA1;
const SET_NORMAL_DISPLAY            = 0xA6;
const SET_REVERSE_DISPLAY           = 0xA7;
const SET_MULTIPLEX_RATIO           = 0xA8;
const OUTPUT_FOLLOWS_RAM            = 0xA4;
const OUTPUT_IGNORES_RAM            = 0xA5;

const SET_DISPLAY_OFFSET            = 0xD3;
const SET_DISPLAY_CLOCK_DIVIDE      = 0xD5;
const SET_PRE_CHARGE_PERIOD         = 0xD9;
const SET_COM_PINS_HARDWARE_CONFIG  = 0xDA;
const SET_VCOMH                     = 0xDB;
const SET_DC_DC_ENABLE              = 0x8D;
/* eslint-enable no-unused-vars */

class Oled {
  constructor(opts) {
    opts = opts || {};

    this.ADDRESS = opts.address  || 0x3C;
    this.DEVICE  = opts.device   || '/dev/i2c-1';

    // new blank buffer
    this.buffer     = Buffer.alloc((WIDTH * HEIGHT) / 8, 0x00);
    this.dirtyBytes = [];

    // Setup i2c
    this.wire = new I2c(this.ADDRESS, {device: this.DEVICE});

    // Cursor position for text
    this.cursorX = 0;
    this.cursorY = 0;
  }

  async initialize() {
    // sequence of bytes to initialize with
    const initSeq = [
      DISPLAY_OFF,
      SET_MEMORY_ADDRESSING_MODE, 0x02, // 0x00 horizontal, 0x01 vertical, 0x02 page
      SET_PAGE_ADDRESS, // start at page address 0
      SET_COM_OUTPUT_SCAN_DIRECTION,
      LOW_COLUMN_ADDRESS,
      HIGH_COLUMN_ADDRESS,
      START_LINE_ADDRESS,
      SET_CONTRAST_CTRL_REG, 0x7F,
      SET_SEGMENT_REMAP,
      SET_NORMAL_DISPLAY,
      SET_MULTIPLEX_RATIO, 0x3F,
      OUTPUT_FOLLOWS_RAM,
      SET_DISPLAY_OFFSET, 0x00,  // no offset
      SET_DISPLAY_CLOCK_DIVIDE, 0xF0,
      SET_PRE_CHARGE_PERIOD, 0x22,
      SET_COM_PINS_HARDWARE_CONFIG, 0x12,
      SET_VCOMH, 0x20, // 0.77xVcc
      SET_DC_DC_ENABLE, 0x14,
      DISPLAY_ON,
    ];

    // write init seq commands
    for(let i = 0; i < initSeq.length; i++) {
      await this._transfer('cmd', initSeq[i]);
    }
  }

  // writes both commands and data buffers to this device
  async _transfer(type, val) {
    let control;

    if(type === 'data') {
      console.log('_transfer(data)');
      control = 0x40;
    } else if(type === 'cmd') {
//      console.log('_transfer(cmd)', '0x' + val.toString(16));
      control = 0x00;
    } else {
      return;
    }
    await new Promise((resolve, reject) => {
      this.wire.writeBytes(control, [val], err => {
        if(err) {
          return reject();
        }

        resolve();
      });
    });
  }

  async _transferData(val) {
//    console.log('_transferData', val.length);

    const control = 0x40;
    const size = DATA_SIZE;

    for(let i = 0; i < val.length; i += size) {
      const smallarray = val.slice(i, i + size);

      await new Promise((resolve, reject) => {
        this.wire.writeBytes(control, smallarray, err => {
          if(err) {
            return reject();
          }

          resolve();
        });
      });
    }
  }

  // read a byte from the oled
  _readI2C(fn) {
    this.wire.readByte((err, data) => {
      if(err) {
        throw err;
      }

      fn(data);
    });
  }

  // sometimes the oled gets a bit busy with lots of bytes.
  // Read the response byte to see if this is the case
  _waitUntilReady() {
    return new Promise(resolve => {
      const tick = () => {
        this._readI2C(byte => {
          // read the busy byte in the response
          const busy = byte >> 7 & 1;

          if(busy) {
            process.nextTick(tick);
          } else {
            // if not busy, it's ready for callback
            return resolve();
          }
        });
      };

      process.nextTick(tick);
    });
  }

  // set starting position of a text string on the oled
  setCursor(x, y) {
    this.cursorX = x;
    this.cursorY = y;
  }

  // write text to the oled
  async writeString(font, size, string, color, wrap, linespacing, sync = true) {
    const wordArr = string.split(' ');
    const len = wordArr.length;
    // start x offset at cursor pos
    let   offset = this.cursorX;
    let   padding = 0;
    const letspace = 1;
    const leading = linespacing || 2;

    // loop through words
    for(let w = 0; w < len; w += 1) {
      // put the word space back in
      wordArr[w] += ' ';
      const stringArr = wordArr[w].split('');
      const slen = stringArr.length;
      const compare = (font.width * size * slen) + (size * (len - 1));

      // wrap words if necessary
      if(wrap && len > 1 && (offset >= (WIDTH - compare))) {
        offset = 1;
        this.cursorY += (font.height * size) + size + leading;
        this.setCursor(offset, this.cursorY);
      }

      // loop through the array of each char to draw
      for(let i = 0; i < slen; i += 1) {
        // look up the position of the char, pull out the buffer slice
        const charBuf = this._findCharBuf(font, stringArr[i]);
        // read the bits in the bytes that make up the char
        const charBytes = this._readCharBytes(charBuf);

        // draw the entire character
        this._drawChar(font, charBytes, size, false);

        // calc new x position for the next char, add a touch of padding too if it's a non space char
        padding = stringArr[i] === ' ' ? 0 : size + letspace;
        offset += (font.width * size) + padding;

        // wrap letters if necessary
        if(wrap && (offset >= (WIDTH - font.width - letspace))) {
          offset = 1;
          this.cursorY += (font.height * size) + size + leading;
        }
        // set the 'cursor' for the next char to be drawn, then loop again for next char
        this.setCursor(offset, this.cursorY);
      }
    }
    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // draw an individual character to the screen
  _drawChar(font, byteArray, size, sync = true) {
    // take your positions...
    const x = this.cursorX;
    const y = this.cursorY;

    let   pagePos = 0;
    let   c = 0;

    // loop through the byte array containing the hexes for the char
    for(let i = 0; i < byteArray.length; i += 1) {
      pagePos = Math.floor(i / font.width) * 8;
      for(let j = 0; j < 8; j += 1) {
        // pull color out
        const color = byteArray[i][j];
        let   xpos;
        let   ypos;

        // standard font size
        if(size === 1) {
          xpos = x + c;
          ypos = y + j + pagePos;
          this.drawPixel([xpos, ypos, color], false);
        } else {
          // MATH! Calculating pixel size multiplier to primitively scale the font
          xpos = x + (i * size);
          ypos = y + (j * size);
          this.fillRect(xpos, ypos, size, size, color, false);
        }
      }
      c = c < font.width - 1 ? c += 1 : 0;
    }
  }

  // get character bytes from the supplied font object in order to send to framebuffer
  _readCharBytes(byteArray) {
    let   bitArr = [];
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
    // use the lookup array as a ref to find where the current char bytes start
    const cBufPos = font.lookup.indexOf(c) * font.width;
    // slice just the current char's bytes out of the fontData array and return
    const cBuf = font.fontData.slice(cBufPos, cBufPos + font.width);

    return cBuf;
  }

  // send the entire framebuffer to the oled
  async update(startPage = 0, endPage = MAX_PAGE_COUNT) {
    console.log('update', {startPage, endPage});

    // wait for oled to be ready
    await this._waitUntilReady();

    for(let index = startPage; index < endPage; index++) {
      const displaySeq = [
        SET_PAGE_ADDRESS + index,
        0x00, // low column start address
        0x10, // high column start address
      ];

      const displaySeqLen = displaySeq.length;

      // send intro seq
      for(let i = 0; i < displaySeqLen; i += 1) {
        await this._transfer('cmd', displaySeq[i]);
      }

      // write buffer data
      const start = index * WIDTH;
      const end   = start + WIDTH;
      const slice = this.buffer.slice(start, end);

      console.log('update', {index});
      await this._transferData([0x00, 0x00]); // it seems like there are two pixels per page, not shown
      await this._transferData(slice);
    }

    // now that all bytes are synced, reset dirty state
    this.dirtyBytes = [];
  }

  // send dim display command to oled
  async dimDisplay(bool) {
    let contrast;

    if(bool) {
      contrast = 0; // Dimmed display
    } else {
      contrast = 0xCF; // Bright display
    }

    await this._transfer('cmd', this.SET_CONTRAST);
    await this._transfer('cmd', contrast);
  }

  // turn oled off
  async turnOffDisplay() {
    await this._transfer('cmd', this.DISPLAY_OFF);
  }

  // turn oled on
  async turnOnDisplay() {
    await this._transfer('cmd', this.DISPLAY_ON);
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
  async invertDisplay(bool) {
    if(bool) {
      await this._transfer('cmd', this.INVERT_DISPLAY); // inverted
    } else {
      await this._transfer('cmd', this.NORMAL_DISPLAY); // non inverted
    }
  }

  // draw an image pixel array on the screen
  async drawBitmap(pixels, sync = true) {
    let   x;
    let   y;

    for(let i = 0; i < pixels.length; i++) {
      x = Math.floor(i % WIDTH);
      y = Math.floor(i / WIDTH);

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

      if(x > WIDTH || y > HEIGHT) {
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
        byte = x + (WIDTH * page);
      }

      // colors! Well, monochrome.
      if(color === 'BLACK' || color === 0) {
        this.buffer[byte] &= ~pageShift;
      }
      if(color === 'WHITE' || color > 0) {
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
    console.log('updateDirtyBytes', this.dirtyBytes);

    const blen = byteArray.length;

    await this._waitUntilReady();

    let   pageStart = Infinity;
    let   pageEnd = 0;
    let   any = false;

    // iterate through dirty bytes
    for(let i = 0; i < blen; i += 1) {
      const b = byteArray[i];

      if(b >= 0 && b < this.buffer.length) {
        const page = b / WIDTH | 0;

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

    await this.update(pageStart, pageEnd + 1);

    // now that all bytes are synced, reset dirty state
    this.dirtyBytes = [];
  }

  // using Bresenham's line algorithm
  async drawLine(x0, y0, x1, y1, color, sync = true) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let   err = (dx > dy ? dx : -dy) / 2;

    while(true) {
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

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // Draw an outlined  rectangle
  async drawRect(x, y, w, h, color, sync = true) {
    // top
    this.drawLine(x, y, x + w, y, color, false);

    // left
    this.drawLine(x, y + 1, x, y + h - 1, color, false);

    // right
    this.drawLine(x + w, y + 1, x + w, y + h - 1, color, false);

    // bottom
    this.drawLine(x, y + h - 1, x + w, y + h - 1, color, false);

    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
  }

  // draw a filled rectangle on the oled
  async fillRect(x, y, w, h, color, sync = true) {
    // one iteration for each column of the rectangle
    for(let i = x; i < x + w; i += 1) {
      // draws a vert line
      this.drawLine(i, y, i, y + h - 1, color, false);
    }
    if(sync) {
      await this._updateDirtyBytes(this.dirtyBytes);
    }
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

  // activate scrolling for rows start through stop
  async startScroll(dir, start, stop) {
    const cmdSeq = [];

    switch(dir) {
      case 'right':
        cmdSeq.push(this.RIGHT_HORIZONTAL_SCROLL);
        break;
      case 'left':
        cmdSeq.push(this.LEFT_HORIZONTAL_SCROLL);
        break;
      case 'left diagonal':
        cmdSeq.push(
          this.SET_VERTICAL_SCROLL_AREA,
          0x00,
          HEIGHT,
          this.VERTICAL_AND_LEFT_HORIZONTAL_SCROLL,
          0x00,
          start,
          0x00,
          stop,
          0x01,
          this.ACTIVATE_SCROLL
        );
        break;
      case 'right diagonal':
        cmdSeq.push(
          this.SET_VERTICAL_SCROLL_AREA,
          0x00,
          HEIGHT,
          this.VERTICAL_AND_RIGHT_HORIZONTAL_SCROLL,
          0x00,
          start,
          0x00,
          stop,
          0x01,
          this.ACTIVATE_SCROLL
        );
        break;
      default:
        throw new Error(`Unhandled dir ${dir}`);
    }

    await this._waitUntilReady();

    if(dir === 'right' || dir === 'left') {
      cmdSeq.push(
        0x00, start,
        0x00, stop,
        0x00, 0xFF,
        this.ACTIVATE_SCROLL
      );
    }

    let   i;
    const cmdSeqLen = cmdSeq.length;

    for(i = 0; i < cmdSeqLen; i += 1) {
      await this._transfer('cmd', cmdSeq[i]);
    }
  }

  // stop scrolling display contents
  async stopScroll() {
    await this._transfer('cmd', this.DEACTIVATE_SCROLL); // stahp
  }
}

module.exports = Oled;