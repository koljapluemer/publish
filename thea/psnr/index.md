---
target: web
---


# Unsere Frage

## Wie viel Qualität bleibt erhalten, nachdem wir ein *Bild* mit *Algo X* (vs *Algo Y*) komprimiert haben?

![original|250](./original.jpg)
![deepfried|250](./fried.jpg)
![gif|250](./to_gif.jpg)

*(original, JPG-style, GIF-style 4 colors)*


???

```thea rosy-plume
base_small.jpg and fried_small.jpg are two 50x50 pixel images, the latter is a compressed version of the former.
Demonstrate how PSNR works by showing how the kernel moves over them, collecting the pixel differences.
Make the kernel 1px wide and tall.
Show only one visualization row: og image, compressed image, and heatmap demonstrating the read difference, then a column where we continously show the extracted square errors. At the bottom of that column, show the current Mean Square Error. Do not add other stuff, values or formulas, except the controls for the following:
Allow user to set kernel speed and to start/stop/reset the animation.
```
!!!


???

```
error_sum = 0
nr_of_pixels = 0

for row in rows:
  for col in colums:
     error_at_this_pixel = (original_image(row, col) - compressed_image(row, col)) ^ 2
     error_sum += error_at_this_pixel
     nr_of_pixels += 1

mean_square_error = error_sum / nr_of_pixels
```

Diesen extrem simplen Code können wir auch als sehr nervige Formel ausdrücken:

```thea orange-canyon
Visualize the long-form MSE for Peak Signal-to-Noise Ratio.
Show only that formula, not the PSNR base formula. Render the formula with proper TeX. 
Make the parts hoverable so we can see what each part of the formula means.
Do not add labels, titles or anything else apart from that.
```

...diesen MSE nehmen wir dann, und *teilen den maximal möglichen Pixelwert zum Quadrat durch diesen MSE*:

$$\frac{\mathrm{MAX}_I^2}{\mathrm{MSE}}$$

...und das konvertieren wir zu *Dezibel*, um die tendenziell extrem niedrigen oder extrem hohen Werte auf eine lesbare Skala zu konvertieren:

$$\mathrm{PSNR} = 10\log_{10}\!\left(\frac{\mathrm{MAX}_I^2}{\mathrm{MSE}}\right)$$


| Ratio $(\mathrm{MAX}_I^2 / \mathrm{MSE})$ | PSNR (dB) |
|---:|---:|
| 1 | 0 |
| 10 | 10 |
| 100 | 20 |
| 1,000 | 30 |
| 10,000 | 40 |
| 100,000 | 50 |


!!!

???
...und das ist:


# Peak Signal-to-Noise Ratio (PSNR)

Laut: `ffmpeg -i ORIGINAL.jpg -i KOMPRIMIERT.jpg -lavfi psnr -f null -`...

...hat das JPG-komprimierte Bild im Vergleich zum Original **PSNR von 25.45**
![deepfried|250](./fried.jpg) 

...hat das GIF-komprimierte Bild im Vergleich zum Original **PSNR von 23.45**
![gif|250](./to_gif.jpg) 

## → JPG Kompression gewinnt gegen 4-Color GIF im Sinne vom PSNR

!!!