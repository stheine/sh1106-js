'use strict';

const fs       = require('fs');

const assert   = require('assertthat');
const delay    = require('delay');
const PngJs    = require('pngjs').PNG;
const rpio     = require('rpio');

const Oled     = require('../');

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

    test.skip('drawLine', async() => {
      await oled.drawLine(10, 0, 127, 0, 'WHITE', true);
      await oled.drawLine(127, 10, 127, 63, 'WHITE', true);
      await oled.drawLine(117, 63, 0, 63, 'WHITE', true);
      await oled.drawLine(0, 53, 0, 0, 'WHITE', true);
    });

    test.skip('drawRect', async() => {
      await oled.drawRect(0, 0, 128, 64, 'WHITE', true);
      await oled.drawPixel([
        [1, 10, 'WHITE'],
        [10, 1, 'WHITE'],
        [126, 10, 'WHITE'],
        [117, 62, 'WHITE'],
      ], true);
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

    test('drawBitmap', done => {
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
  });
});
