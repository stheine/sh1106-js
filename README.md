# stheine/sh1106-js

## Reference

- https://github.com/noopkat/oled-js
- https://www.waveshare.com/w/upload/5/5e/SH1106.pdf
- https://www.velleman.eu/downloads/29/infosheets/sh1106_datasheet.pdf
- https://www.mikrocontroller.net/topic/431371

## What is this?

This library provides APIs for the
[SH1106 I2C/SPI compatible monochrome OLED display](https://www.amazon.de/gp/product/B078J78R45/)
([Data sheet](https://www.velleman.eu/downloads/29/infosheets/sh1106_datasheet.pdf)).

It can run on the Raspberry Pi (and probably other systems that have I2C interface).

This library has originated from a fork of [oled-js](https://github.com/noopkat/oled-js).

## Connect the OLED display

Connect the OLED display to the I2C pins:

- GND, Pin 6
- Vcc, 3,3V, Pin 1
- SDA, Pin 3
- SCL, Pin 5

## Use the library

```javascript
const rpio   = require('rpio');
const Oled   = require('../sh1106-js/'); // TODO npm module

// Rpio
rpio.init({
  gpiomem: false,
  mapping: 'physical',
});

// Oled
const oled = new Oled({rpio});
```

By default, the library connects the OLED with address `0x3c`. This can be overwritten in `new Oled({rpio, address: '0x3d'});`
```

### Wait, how do I find out the I2C address of my OLED screen?

The following command sequence will show the I2C bus number and connected devices on your system:

```sh
$ ll /dev/i2c-*
crw-rw---- 1 root i2c 89, 1 Dec 22 12:26 /dev/i2c-1

$ i2cdetect 1
WARNING! This program can confuse your I2C bus, cause data loss and worse!
I will probe file /dev/i2c-1.
I will probe address range 0x03-0x77.
Continue? [Y/n] y
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:          03 -- -- -- -- -- -- -- -- -- -- -- --
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
30: -- -- -- -- -- -- -- -- -- -- -- -- 3c -- -- --
40: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
70: -- -- -- -- -- -- -- --
```

## API general

### color

Colors can be specified as either `0` or `'BLACK'` for black, or `1` or `'WHITE'` for white.

### sync

Most API calls take the optional `sync` argument. This specifies whether to update the screen immediately with result. Default is `true`.

## API

### clearDisplay(sync = true)
Fills the buffer with 'off' pixels (0x00).

Usage:
```javascript
oled.clearDisplay();
```

### dimDisplay(contrast)
Sets the contrast on the display. The `contrast` can be a number from `0x00` (dark) to `0xff` (bright).

Usage:
```javascript
oled.dimDisplay(0xff);
```

### invertDisplay(invert)
Inverts the pixels on the display. Black becomes white, white becomes black. This method takes one argument, a boolean. `true` for inverted state, `false` to restore normal pixel colors.

Usage:
```javascript
oled.invertDisplay(true|false);
```

### turnOffDisplay()
Turns the display off.

Usage:
```javascript
oled.turnOffDisplay();
```

### turnOnDisplay()
Turns the display on.

Usage:
```javascript
oled.turnOnDisplay();
```

### drawPixel(pixels, sync = true)
Draws one or multiple pixels at a specified position on the display. The `pixels` can be the definition of one pixel, or a list of pixels.

Each pixel is an array `[0: x position, 1: y position, 2: color]`.

Usage:
```javascript
// draws single white pixels total
oled.drawPixel([10, 10, 'WHITE']);

// draws 4 white pixels total
oled.drawPixel([
  [128, 1, 'WHITE'],
  [128, 32, 'WHITE'],
  [128, 16, 'WHITE'],
  [64, 16, 'WHITE']
]);
```

### drawLine(x0, y0, x1, y0, color, sync = true)
Draws a one pixel wide line.

Arguments:
- `x0`, `y0` - start location of line
- `x1`, `y1` - end location of line
- `color` - color of the line

Usage:
```javascript
oled.drawLine(0, 0, 127, 63, 'WHITE');
```

### drawDashedLine(x0, y0, x1, y0, initialColor, interval, sync = true)
Draws a one pixel wide, dashed line. The dashes change color every `interval` pixels.

Arguments:
- `x0`, `y0` - start location of line
- `x1`, `y1` - end location of line
- `initialColor` - color of the first line dash segment
- `interval` - length of each line dash segment (Setting `interval=0` creates a solid line)

Usage:
```javascript
oled.drawDashedLine(0, 0, 127, 63, 'WHITE', 1);
oled.drawDashedLine(127, 0, 0, 63, 'WHITE', 5);
```

### drawRect(x, y, w, h, color, sync = true)
Draws an outlined rectangle.

Arguments:
- `x`, `y` - top left corner of rectangle
- `w`, `h` - `width` and `height` of rectangle (Setting `width=0` and `height=0` created a single pixel)
- `color` - color of rectangle

Usage:
```javascript
oled.drawRect(0, 0, 128, 64, 'WHITE');
```

### drawDashedRect(x, y, w, h, initialColor, sync = true)
Draws an outlined rectangle, using dashed lines.

Arguments:
- `x`, `y` - top left corner of rectangle
- `w`, `h` - `width` and `height` of rectangle (Setting `width=0` and `height=0` created a single pixel)
- `initialColor` - color of each line's first dash segment
- `interval` - length of each line dash segment (Setting `interval=0` creates a solid line)

### fillRect(x, y, w, h, color, sync = true)
Draws a filled rectangle.

Arguments:
- `x`, `y` - top left corner of rectangle
- `w`, `h` - `width` and `height` of rectangle (Setting `width=0` and `height=0` created a single pixel)
- `color` - color of rectangle

Usage:
```javascript
oled.fillRect(0, 0, 127, 63, 'WHITE');
```

### fillDashedRect(x, y, w, h, initialColor, interval, sync = true)
Draws a checkered rectangle. The color changes every `interval` pixels.

Arguments:
- `x`, `y` - top left corner of rectangle
- `w`, `h` - `width` and `height` of rectangle (Setting `width=0` and `height=0` created a single pixel)
- `initialColor` - color of the top left segment
- `interval` - size of each segment (Setting `interval=0` creates a solid rectangle)

Usage:
```javascript
oled.fillDashedRect(0, 0, 127, 63, 'WHITE', 5);
```

### drawCircle(x, y, r, color, sync = true)
Draws an outlined circle.

Arguments:
- `x`, `y` - location of circle's center
- `r` - radius of circle
- `color` - color of circle

Usage:
```javascript
oled.drawCircle(30, 10, 5, 'WHITE');
```

### drawBitmap(data)
Draws a bitmap using raw pixel data returned from an image parser. The image sourced must be monochrome, and indexed to only 2 colors. Resize the bitmap to your screen dimensions first. Using an image editor or ImageMagick might be required.

Optional bool as last argument specifies whether screen updates immediately with result. Default is true.

Tip: use a NodeJS image parser to get the pixel data, such as [pngjs](https://www.npmjs.org/package/pngjs). See the test for an example.

### writeString(x, y, font, string, color, sync = true)
Writes a string of text to the display.

Arguments:
- `x`, `y` - top left location of text
- `font` - font to display (see below)
- `string` - string to display
- `color` - color of circle

Fonts can be generated using the [oled-js font foundry](https://stheine.github.io/oled-js-font-foundry/) (note, the original oled-js font foundry by noopkat is buggy in the handling of larger fonts. Fonts generated there are incompatible).

Usage:
```
npm install oled-font-5x7
```

```javascript
const font = require('oled-font-5x7');

oled.writeString(1, 1, font, 'WHITE', 'Cats and dogs');
```

### update(startPage = 0, endPage = 7)
Sends the current buffer state to the OLED display.

This only needs to be called if `sync=false` option has been given in draw calls.

The OLED display is segmented in 8 pages, each 8 rows of pixels high. `oled.update(0, 0)` will update the top 8 rows of pixels only. By default you don't have to specify the `startPage` and `endPage`, but you might want to optimze the refresh of a certain region of the display only.

Usage:
```javascript
oled.update();
```
