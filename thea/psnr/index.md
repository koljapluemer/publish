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

```py
error_sum = 0
nr_of_pixels = 0

for row in rows:
  for col in colums:
     error_at_this_pixel = (original_image(row, col) - compressed_image(row, col)) ^ 2
     error_sum += error_at_this_pixel
     nr_of_pixels += 1

mean_square_error = error_sum / nr_of_pixels
```

```thea orange-canyon
Visualize the long-form MSE for Peak Signal-to-Noise Ratio.
Show only that formula, not the PSNR base formula. Render the formula with proper TeX. 
Make the parts hoverable so we can see what each part of the formula means.
Do not add labels, titles or anything else apart from that.
```



!!!

???
...und das ist:


# Peak Signal-to-Noise Ratio (PSNR)

!!!