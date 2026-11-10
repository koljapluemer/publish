---
target: web
---

# Peak Signal-to-Noise Ratio

## What are we trying to answer?

*How well has our image survived the compression we just did*?

![original|500](./original.jpg)
![deepfried|500](./fried.jpg)


```thea serene-yak
Visualize the formula for the Peak Signal-to-Noise Ratio.
Render the formula with proper TeX. Make the parts hoverable so we can see what each part of the formula means.
Do not add labels, titles or anything else apart from that.
Do not add the MSE formula, just the basic PSNR.
```

```thea orange-canyon
Visualize the long-form MSE for Peak Signal-to-Noise Ratio.
Show only that formula, not the PSNR base formula. Render the formula with proper TeX. 
Make the parts hoverable so we can see what each part of the formula means.
Do not add labels, titles or anything else apart from that.
```

```thea rosy-plume
base_small.jpg and fried_small.jpg are two 50x50 pixel images, the latter is a compressed version of the former.
Demonstrate how PSNR works by showing how the kernel moves over them, collecting the pixel differences.
Make the kernel 1px wide and tall.
Show only one visualization row: og image, compressed image, and heatmap demonstrating the read difference. Do not add other stuff, except the controls for the following:
Allow user to set kernel speed and to start/stop/reset the animation.
```

```thea upbeat-quasar
base_small.jpg and fried_small.jpg are two 50x50 pixel images, the latter is a compressed version of the former.
Demonstrate how PSNR works by showing how the kernel moves over them, collecting the pixel differences.
Below this, visualize the MSE and the base PSNR in proper tex, live updating the formula values as the kernel moves. Make sure to include the sums etc, the workings of the formula should be fully understandable.
Make the kernel 1x1 px. 
Allow user to set kernel speed and to start/stop/reset the animation.
```

```thea upbeat-tiger
Demonstrate how decibel work in the abstract.
Offer an input field for numbers.
Show a simple number-line where this number gets converted to decibel, showcasing how decibel 'shrinks the range'.
Show just that, don't add explanatory labels or titles
```
