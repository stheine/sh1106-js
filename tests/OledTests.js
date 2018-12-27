'use strict';

const fs     = require('fs');

const assert = require('assertthat');
const delay  = require('delay');
const font7  = require('oled-font-5x7');
const PngJs  = require('pngjs').PNG;
const rpio   = require('rpio');

const font16 = require('./oled-js-font-Consolas-16.js');

const Oled   = require('../');

suite('Oled', () => {
  test('is a function', async() => {
    assert.that(Oled).is.ofType('function');
  });

  suite('oled', () => {
    let oled;

    suiteSetup(async() => {
      rpio.init({
        gpiomem: false,
        mapping: 'physical',
      });

      oled = new Oled({rpio});

      await oled.initialize();
//      await oled.dimDisplay(0x00);
//      await oled.clearDisplay(true);
//      await oled.update();
    });

    test('init', async() => {
      assert.that(oled).is.ofType('object');
    });

    test.skip('invertDisplay', async() => {
      await oled.invertDisplay(true);
    });

    test.skip('drawPixel', async() => {
      await oled.drawPixel([
        [0, 0, 'WHITE'],
        [0, 63, 'WHITE'],
        [127, 0, 'WHITE'],
        [127, 63, 'WHITE'],
      ], true);
    });

    test.skip('drawDashedLine', async() => {
      await oled.drawDashedLine(10,   0, 127,  0, 'WHITE', 1, true);
      await oled.drawDashedLine(127, 10, 127, 63, 'WHITE', 2, true);
      await oled.drawDashedLine(117, 63,   0, 63, 'WHITE', 3, true);
      await oled.drawDashedLine(0,   53,   0,  0, 'WHITE', 4, true);
      await oled.drawDashedLine(1,   53,   1,  0, 'BLACK', 4, true);
      await oled.drawDashedLine(0,    0, 127, 63, 'WHITE', 0, true);
    });

    test.skip('drawLine', async() => {
      await oled.drawLine(10, 0, 127, 0, 'WHITE', true);
      await oled.drawLine(127, 10, 127, 63, 'WHITE', true);
      await oled.drawLine(117, 63, 0, 63, 'WHITE', true);
      await oled.drawLine(0, 53, 0, 0, 'WHITE', true);
    });

    test.skip('drawDashedRect', async() => {
      await oled.drawDashedRect(0, 0, 128, 64, 'WHITE', 1, true);
      await oled.drawDashedRect(10, 10, 20, 20, 'WHITE', 2, true);
      await oled.drawDashedRect(40, 40, 20, 20, 'WHITE', 3, true);
      await oled.drawDashedRect(62, 10, 20, 20, 'WHITE', 4, true);
      await oled.drawDashedRect(94, 30, 20, 20, 'WHITE', 5, true);
    });

    test.skip('drawRect', async() => {
      await oled.drawRect(0, 0, 128, 64, 'WHITE', true);
      await oled.drawPixel([
        [1, 10, 'WHITE'],
        [10, 1, 'WHITE'],
        [126, 10, 'WHITE'],
        [117, 62, 'WHITE'],
      ], true);
      await oled.drawRect(94, 30, 20, 20, 'WHITE', true);
    });

    test.skip('fillDashedRect', async() => {
      await oled.fillDashedRect(0,  0, 32, 64, 'WHITE', 0, true);
      await oled.fillDashedRect(31, 0, 32, 64, 'WHITE', 1, true);
      await oled.fillDashedRect(63, 0, 32, 64, 'WHITE', 2, true);
      await oled.fillDashedRect(95, 0, 32, 64, 'WHITE', 3, true);
    });

    test.skip('fillRect', async() => {
      await oled.fillRect(0, 0, 128, 64, 'WHITE', true);
      await oled.drawPixel([
        [0, 10, 'BLACK'],
        [10, 10, 'BLACK'],
        [10, 11, 'BLACK'],
        [11, 11, 'BLACK'],
        [11, 10, 'BLACK'],
        [10, 0, 'BLACK'],
        [127, 53, 'BLACK'],
        [117, 63, 'BLACK'],
      ], true);
      await oled.drawLine(0, 63, 127, 0, 'BLACK', true);
      await oled.fillRect(104, 40, 20, 20, 'BLACK', true);
    });

    test.skip('overwrite', async() => {
      await oled.fillRect(120, 0, 8, 64, 'WHITE', false);
      await oled.fillRect(121, 1, 6, 62, 'BLACK', false);
      await oled.fillRect(121, 10, 6, 30, 'WHITE', true);
      for(let i = 1; i < 110; i++) {
        await oled.fillRect(0, 16, 110, 16, 'BLACK', true);
        await oled.fillRect(0, 16, i, 16, 'WHITE', true);
        await delay(10);
      }
    });

    test.skip('drawCircle', async() => {
      await oled.drawCircle(63, 32, 31, 'WHITE', true);
    });

    test.skip('drawBitmap', done => {
      fs.createReadStream('tests/images/mono-128x64.png')
      .pipe(new PngJs())
      .on('parsed', data => {
        const dataChannel4 = [];

        for(let i = 0; i < data.length; i += 4) {
          dataChannel4.push(data[i]);
        }

        oled.drawBitmap(dataChannel4);
        done();
      });
    });

    test.skip('writeString', async() => {
      const font = font7;

      await oled.writeString(0, 0, font, 'abcdefghijklmnopqrstuvwxyz', 'WHITE', false);
      await oled.writeString(0, 57, font, '12345678901234567890', 'WHITE', false);

      await oled.update();
    });

    test.skip('char', async() => {
      const font = font16;

      const drawChar = async function(x, y, char, color = 'WHITE', box = false) {
        await oled.writeString(x, y, font, char, color, false);

        if(box) {
          await oled.drawLine(x - 5, y - 2, x + font.width + 5, y - 2, 'WHITE', false);
          await oled.drawLine(x - 5, y + font.height + 1, x + font.width + 5, y + font.height + 1, 'WHITE', false);
          await oled.drawLine(x - 2,  y - 5, x - 2, y + font.height + 5, 'WHITE', false);
          await oled.drawLine(x + font.width + 1,  y - 5, x + font.width + 1, y + font.height + 5, 'WHITE', false);
        }
      };

      await drawChar(5, 5, '@', 'BLACK', true);
      await drawChar(20, 0, 'Q');
      await drawChar(30, 0, 'F');
      await drawChar(40, 0, 'G');
      await drawChar(50, 0, 'g');
      await drawChar(70, 5, 'g', 'BLACK', true);
      await drawChar(20, 20, '[');
      await drawChar(30, 20, ']');
      await drawChar(40, 20, '{');
      await drawChar(50, 20, '}');

      await oled.update();
    });

    test.skip('simple box scrolling', async function() {
      this.timeout(15000);

      for(let x = 120; x >= 0; x--) {
        await oled.fillRect(x, 8, 5, 5, 'WHITE', false);
        await oled.drawLine(x + 5, 8, x + 5, 13, 'BLACK');
        await oled.update();
        await delay(20);
      }
    });

    test.skip('simple scrolling', async function() {
      this.timeout(15000);

      const font = font16;

      for(let x = 128 - font.width; x >= 0; x--) {
        await oled.writeString(x, 8, font, 'A', 'WHITE', false);
        await oled.drawLine(x + font.width, 8, x + font.width, 8 + font.height, 'BLACK');
//        await oled.fillRect(x + font.width, 8, font.width, font.height, 'WHITE', false);
        await oled.update();
        await delay(15);
      }
    });

    test('scrolling', async function() {
      this.timeout(15000);

      const font = font16;

      const displayString = ' abcdefghijklmnopqrstuvwxyz ';

      for(let i = 0; i < displayString.length * font.width; i++) {
        const x = -(i % font.width);

        await oled.writeString(x, 8, font, displayString.substring(i / font.width), 'WHITE', false);
        await oled.update();
        await delay(30);
      }
    });
  });
});
