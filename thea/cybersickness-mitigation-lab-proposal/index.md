---
target: web, pdf
---


# _Cybersickness Mitigation Lab_: An Open-Source Software Suite For Rapid Replication and Innovation of In-Software Anti-Cybersickness Strategies

== Relevance

Cybersickness (CS) is one of the largest problems in Virtual Reality (VR) adoption. This applies to both the end-user domain, where CS critically reduces User Experience and professional domains, where CS may prevent otherwise promising candidates from becoming drone pilots (_there is some paper on this, cite_).

CS can be attacked via hardware solutions (eg. motion platforms, spinning chairs, Natural Walking, ...). However, by nature, these require specific hardware products to be designed, manufactured, shipped and installed whereever usage is desired.
Thus, from a pragmatic perspective, in-software solutions (ie. in the VR application itself) are especially promising, since the aforementioned steps are generally simpler, cheaper and faster when only software is involved.

In this work, we discuss core issues of current in-software CS mitigation research and practice. Furthermore, we contribute an open-source software as a first building block to improve on the current situation. 

== Identified Problem

While a range of in-software CS mitigation strategies have been proposed (including but not limited to rest frames, galvanic stimulation, FoV reduction, optical flow reduction, FPS optimization, scene design, spatial audio and adaptable virtual movement), a comprehensive framework of best practices is lacking.

A long-running scientific discourse on a complex, multifactorial issue such as CS —— which spans physiology, neuroscience, human-computer-interaction, media theory and social effects — is perhaps to be expected. Nonetheless, the lack of clear guidance poses a pragmatic issue for the inquiring practitioner who desires to design a usable VR application right now. 

We believe that siloed research is a core factor in this problem: Currently, a given research team implements a mitigation, runs a single study or study series on it, publishes the results. The process then stops. Replication is seldom attempted.
Experimental setups are manifold, as are CS measurements. One study may follow an iterative qualitative co-design approach, producing a case study as a result, another may be setup as an "A/B test", producing as result an effect size and a p-value. A research team may use a joystick for in-situ felt CS reports, or do a before-and-after comparison of SSQ results. Another may use EEG measurements.

Each published study is thus a combination of assumptions, paradigms, and measurements never seen again before or after. This is reflected in the few reviews and meta-analyses on CS, who note a lack of comparability and extract sweeping results only guardedly _(I think I can cite this lol)_.

Another, related problem: 
// needs better transition/intro
Especially for a practitioner, the possibility to actually experience a proposed CS mitigation is pertinent. 
Consider for example the hypothetical lead of a VR application product team who is currently faced with the problems of users experiencing cybersickness. It is unlikely that she would seriously consider implementing a CS mitigation on the pure merit of an effect size, a significance value and a couple of screenshots. 
To enable her to design a good product, she must see the strategy "in action".
While more and more research in research years adopted the commendable practice of providing a link to a code repository...they are usually bad lol.
// somehow they: but the repos are garbage, outdated unity shit with dead dependencies but no doc
Thus, the large gulf between academic research and practical application (identified in regards to CS and more generally) is perhaps not surprising.

Additionally, circling back to the academic dimension, these code repositories appear yet again to stand alone, essentially unaware of each other: An informal review yielded little to no evidence of cross-fertiliziation between repositories. 

We want to highlight that the problems discussed above are not to be construed as criticism of individual researcher, teams or publications. In fact, we strongly believe that the specific ideas research teams bring to their CS research will eventually deliver to key to resolve most if not all issues surrounding CS — to harness this, we merely need to create a system that enables these works to genuinely build on each other instead of essentially restarting from scratch. 

== Proposal

We propose the `cybersickness mitigation lab`, an open source software tool. Based on the discussion above, it should fulfill:

1. Enable interested parties to quickly experience, test and evaluate cybersickness mitigation strategies
2. Allow concerned researchers to quickly replicate, test and falsify novel or prior cybersickness mitigation strategies.

We implemented `cybersickness mitigation lab` as a static web application, which achieves high portability to a large number of devices (including every modern consumer VR headset and almost any modern Android or Apple phone). The technology is also fully open source with no dependencies to commercial closed-source technology such as `Unity 3D`.

At the core of the app, we defined three main abstractions: _contexts_, _interventions_, and _measurements_.

- A _context_ is the (minimal) VR application context, e.g. a user-controlled low-poly racing game, or a simulated drone flight using a high-resolution Gaussian Splatting scan of a street in Delft
- An _intervention_ is the CS mitigation strategy applied, e.g. "none", "800hz mono tone before a sharp tone" or "FoV vignette effect on acceleration"
- A _measurement_ is a way of measuring CS, e.g. a pre- and post-session SSQ form

By isolating these concepts in code (following a version of _hexagonal design_), we can arbitrarily combine objects of these three abstractions. Additionally, defining clean interfaces in this way allows us — and other interested parties, in the future — to rapidly and reliably add in new contexts, interventions using agentic coding. Thus:

1. Prior art on in-software CS mitigation interventions (eg. strategies proposed by existing papers) can be rapidly integrated. We already integrated _\$n_ of mitigation strategies from descriptions in literature. _add list of cool shit we integrated, so far it's two papers only, but it's really just tokens_
2. Gaps in the three-dimensional matrix spanned by our three abstractions can quickly be filled, answering questions with shapes like _"Does intervention X still works in context Y as measured by Y?"_
3. Novel contexts, interventions and measurements can be rapidly tested against a growing body of references, answering questions like _"How strongly does novel measurement tool X correlate with existing tool Y?"_ and _"Does novel VR interaction Z triggers CS in ways that existing mitigation strategies cannot solve?"_


Importantly, we aim to make our tool usable and useful not only to research teams with timeframes measured in month, but also to casually interested developers or even VR users.
We aim to achieve this by keeping our tool lean, open-source, freely available without barriers (ie. deployed on the public web), well-documented and easy to run and extend.

== Evaluation

We ran a prototypical pre-study to test the usability of `cybersickness mitigation lab` as a serious research tool, testing two arbitrarily chosen CS mitigation strategies from existing research against a base condition.

== Limitations

Some stuff you can't represent in our abstractions.
3js+aframe are sometimes worse than unity, e.g. probably HRTF and shit.
Native apps have some performance and UX advantages over web, but honestly not many.

== Misc

repo here lol: https://github.com/koljapluemer/thesis-cybersickness-mitigation-tests

== Literature

I swear I have citations for most of the stuff I'm saying but I'm on the train rn