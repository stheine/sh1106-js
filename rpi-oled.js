#!/usr/bin/env node

'use strict';

/* eslint-disable no-unused-vars */
const delay = require('delay');
const font  = require('oled-font-5x7');
const rpio  = require('rpio');
/* eslint-enable no-unused-vars */

const Oled  = require('./Oled.js');

(async() => {
  rpio.init({gpiomem: false});
  const oled = new Oled({rpio});

  await oled.initialize();

  await oled.clearDisplay(true);
//  await oled.update();

  await oled.clearDisplay();
  await oled.update();

//  await oled.setCursor(0, 0);
//  await oled.writeString(font, 1, 'hello' , 1, false);
//  await oled.setCursor(10, 10);
//  await oled.writeString(font, 1, 'hello' , 1, false);

  const sync = false;

//  await oled.fillRect(0,  0, 127, 64, 'BLACK', sync);
  await oled.drawRect(0,  0, 127, 64, 'WHITE', sync);

//  await oled.drawRect(52,  2, 10, 10, 'WHITE', sync);
//  await oled.drawRect(42, 12, 10, 10, 'WHITE', sync);
//  await oled.drawRect(32, 22, 10, 10, 'WHITE', sync);
//  await oled.drawRect(22, 32, 10, 10, 'WHITE', sync);
//  await oled.drawRect(12, 42, 10, 10, 'WHITE', sync);
//  await oled.drawRect( 2, 52, 10, 10, 'WHITE', sync);

//  await oled.setCursor(3, 3);
//  await oled.writeString(font, 4, '21:45', 1, sync);


//  await oled.drawRect(0,  0, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0,  8, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0, 16, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0, 24, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0, 32, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0, 40, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0, 48, 126, 7, 'WHITE', sync);
//  await oled.drawRect(0, 56, 126, 7, 'WHITE', sync);

//  await oled.drawRect(0, 0, 126, 63, 'WHITE', false);
//  await oled.fillRect(2, 2, 123, 59, 'WHITE', false);
//  await oled.fillRect(126, 0, 2, 50, 'WHITE', false);

  await oled.update();

//  await delay(1000);

  for(let i = 0; i < 63; i++) {
//    await oled.drawRect(0, 0, i, i * 2, 'WHITE', true);
    await oled.drawPixel([i, i, 'WHITE'], true);
//    await oled.drawRect(i, i, 0, 0, 'WHITE', false);

//    await oled.update();

//    await delay(50);
  }

  setTimeout(async() => {
    await oled.turnOffDisplay();
    rpio.i2cEnd();
  }, 1000);
})();
