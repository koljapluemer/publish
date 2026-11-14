# tako: Agentic, Explorative BIM-Editing in VR

**TLDR:** First prototype for walking around and editing IFC files is now online at [tako.koljasam.com/](https://tako.koljasam.com). Open this URL on a VR headset in the browser and try it out.

_If you don't have the password, ask me (Kolja Sam)_.

Here is a demo of me using voice to add a window to a wall:

![vid](quick_demo_add_window.mp4)


## Technical Decisions

- I based the project on the open [IFC format](https://en.wikipedia.org/wiki/Industry_Foundation_Classes) (as opposed to propietary formats). This makes everything easier, faster and more robust. Any serious engineering/architecture CAD tools support exporting to `IFC`, so there shouldn't be any problems
- I implemented the project as a web app, notably without involving `Unity 3D`.
  - _Advantages_: Can be simply opened on any XR device with internet, we don't have to send around files. It's fully Open Source (except the used AI frontier models), so there is never going to be any license or cost trouble for users or developers


## Not Yet Implemented
