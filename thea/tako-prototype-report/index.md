---
target: web
---

# tako: Agentic, Explorative BIM-Editing in VR

**TLDR:** First prototype for walking around and editing IFC files is now online at [tako.koljasam.com/](https://tako.koljasam.com). Open this URL on a VR headset in the browser and try it out.

_If you don't have the password, ask me (Kolja Sam)_.

Here is a demo of me using voice to add a window to a wall:

![](quick_demo.mp4)
_the Meta Quest only records the video of one eye, that's why the view looks so narrow and stuff is sometimes out of frame. Sorry for that._

## Goals

1. Allow building engineers to quickly prototype/iterate their designs
2. ~~Allow professors to review student submissions of BIM files~~ (goal for a later version)


## UX Stuff

First, here are the full controls:


### Movement

You can move around by walking/moving your head. This is usually called _Natural Walking_ in the literature; quite obviously best when you have lots of space, but also doesn't work with stairs etc. Allow me to demonstrate:

![](mov.mp4){.gif}
_Click on the video to stop it playing._


You can also teleport by pushing the right thumbstick forward, optionally rotating it (to adjust your target rotation), then letting go. This is very standard stuff, I basically stole the UX flow from the Meta Kit (c.f. [this tutorial](https://www.youtube.com/watch?v=a3ojjAIZCmk)). 

Teleporting this way may take a bit of time to learn how to use it at first; which may be a problem with non-technical users (has to be user-tested). Because teleportation doesn't accelerate or move the user, it reduces cybersickness, but the dicontinuous motion may reduce immersion or spatial understanding, [here](https://www.nature.com/articles/s41598-025-12143-y.pdf) is a decent paper discussing this. This may also be a problem (given that the whole point is spatial understanding of a e.g. a given building), but I'm not sure that we have a reasonable alternative, because continuous joystick movement in a tight virtual space (=house) really does make you rather nauseous.

## Tech Stuff


## Technical Decisions

- I based the project on the open [IFC format](https://en.wikipedia.org/wiki/Industry_Foundation_Classes) (as opposed to propietary formats). This makes everything easier, faster and more robust. Any serious engineering/architecture CAD tools support exporting to `IFC`, so there shouldn't be any problems
- I implemented the project as a web app, notably without involving `Unity 3D` or any `Meta` software.
  - _Advantages_: Can be simply opened on any XR device with internet, we don't have to send around files. It's fully Open Source (except the used AI frontier models), so there is never going to be any license or cost trouble for users or developers


## Not Yet Implemented
