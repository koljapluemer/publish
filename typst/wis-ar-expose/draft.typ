
== Background

???

Most algos utilize the exact timestamps of each trial in their calculations.
Following the learning curves above, it is easy to argue why this is needed for accurate recall prediction, as recall depends strongly on the time passed since last trial.

However, there is a class of spaced repetition (there exists some discussion about what exactly constitutes "true" spaced repetition. we simply define it as repetition learning with intentionally adapted intervals) systems that are analog and thus cannot track time except with approximate heuristics. Notably, the Leitner Box.   

== Motivation

Spaced repetition is found to be very effective in declarative learning.
However, timestamps


(could also use this for epaper-flashcard)

a learner may want a physical Leitner box. it's nice b/c haptical and non-digital.

This research is partly inspired by a reddit comment offering the claim that since Spaced Repetition itself is so powerful as a concept that the choice of algorithm does not matter much. 

Here, we model this into a research question: 

== Aim

What we aim to create in this paper is a statement of the following kind:

"If you will use a Leitner Box instead of Anki with FSRS, you will need $n%$ more time to memorize an average flashcard"

The learner can then take this information, weigh it against other facts and preferences, and take an informed decision which learning system to chose. 

== Previous Work

into background??

== Method

Following previous algo evals (I hope), we pick a learner-centered target metric:

1. We consider a flashcard "memorized" when its predicted recall in 365 days as calculated from the latest rep is above 95%
2. We assume that the learner wishes to memorize a flashcard with as little time investment as possible, thus we define *cost* as the number of repetitions needed to reach state (1).

In a first step, we will Monte Carlo over the anki rev dataset, pretending that a given learner used a Leitner box instead (by abstracting sessions/times of trial).

Additionally, we run the simulation on some additional plausible scenarios:

- maybe variation where we put card on front of in-folder stack, at back, or random
- Leitners "mobile box", a system where the learner has a to-go system with just two folders
- Single stack, put wrong 4 cards later
- Single stack, put wrong randomly into the stack (Gauss around center of stack)

In a second step, we will attempt a kind of hyper-parameter optimization on the Leitner box steps. In *So lernt man Lernen*, Leitner gave no justification for the chosen parameters ( Could we design a physical Leitner box that optimizes efficiency?

== Limitations

- SR with its paradigm of "atomic", independent practice trials, ignores or violates a considerable range of "lessons learned" from learning psychology
- SR has an incentive problem: learners want to *opti* retention, not predict it
- all models are wrong, using fsrs as ground truth is not the real world
- whether Anki trials (of unknown content) would map to Leitner cards or not is not certain
