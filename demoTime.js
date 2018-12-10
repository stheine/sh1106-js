'use strict';

const pngtolcd = require('png-to-lcd');
const Oled = require('../');
const font = require('oled-font-5x7');
const temporal = require('temporal');

var oled = new Oled({
  width: 128,
  height: 64,
});

(async() => {
  await test(oled);
})();

// sequence of test displays
async function test(oled) {

//  // if it was already scrolling, stop
//  oled.stopScroll();

  // clear first just in case
  await oled.update();

  // make it prettier
//  await oled.dimDisplay(true);

  temporal.queue([
    {
      delay: 100,
      task: async function() {
        // draw some test pixels
        await oled.drawPixel([
          [0, 0, 1],
          [127, 0, 1],
          [0, 63, 1],
          [127, 63, 1],
        ]);
      }
    },
    {
      delay: 2000,
      task: async function() {
        await oled.clearDisplay();
        // display a bitmap
        pngtolcd(__dirname + '/images/cat-128x64.png', true, async function(err, bitmapbuf) {
          oled.buffer = bitmapbuf;
          await oled.update();
        });

      }
    },
    {
      delay: 2000,
      task: async function() {
        await oled.clearDisplay();
        // display text
        await oled.setCursor(0, 0);
        await oled.writeString(font, 1, 'Cats and dogs are really cool animals, you know.', 1, true, 2);
      }
    },
    {
      delay: 2000,
      task: async function() {
        await oled.clearDisplay();
        // draw some lines
        await oled.drawLine(0, 0, 127, 63, 1);
        await oled.drawLine(0, 63, 127, 0, 1);
        await oled.drawLine(63, 0, 63, 63, 1);
        await oled.drawLine(0, 31, 127, 31, 1);
      }
    },
    {
      delay: 2000,
      task: async function() {
        await oled.clearDisplay();
        // draw a rectangle
        await oled.fillRect(0, 0, 10, 20, 1);
      }
    },
    {
      delay: 2000,
      task: async function() {
        // create concenctric rectangle outlines
        await oled.clearDisplay();

        //calc how many squares we can fit on the screen
        var padding = 2;
        var square_count = ((128 / 2 ) / (padding * 2) ) - 1;

        for(var i = 0; i < square_count; i ++){
          var x =  ((i + 1) * padding);
          var y =  ((i + 1) * padding);
          var w = 128 - (x * padding);
          var h = 64 - (y * padding);
          await oled.drawRect(x, y, w, h, 1, false);
        }
        await oled.update();
      }
    },
    {
      delay: 2000,
      task: async function() {
        // create concenctric circle outlines
        await oled.clearDisplay();

        var x = 128 / 2;
        var y = 64 / 2;
        var radius = 64 - 1

        //calc how many circles we can fit on the screen
        var circle_count = radius / 3;

        for(var i = 0; i < circle_count; i++){
          var r = radius - (i * 3);
          await oled.drawCircle(x, y, r, 1, false);
        }
        await oled.update();
      }
    },
//    {
//      delay: 2000,
//      task: async function() {
//        oled.clearDisplay();
//        // display text
//        oled.setCursor(0, 7);
//        oled.writeString(font, 2, 'SCROLL!', 1, true, 1);
//        oled.startScroll('left', 0, 6);
//      }
//    },
//    {
//      delay: 2000,
//      task: async function() {
//        oled.stopScroll();
//        oled.clearDisplay();
//        oled.update();
//        oled.setCursor(0, 7);
//        oled.writeString(font, 2, 'DIAGONAL SCROLL', 1, true, 1);
//        oled.startScroll('left diagonal', 0, 15);
//      }
//    }
  ]);
}
