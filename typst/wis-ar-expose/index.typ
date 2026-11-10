Exposé Kolja Sam Plümer
= Optimierung von Flashkartenlernen ohne Zeitstempel

_Spaced Repetition_ (Wiederholen von Lern-Items in algorithmisch berechneten Intervallen @cepeda2008spacing) ist effektiv für das Auswendiglernen von deklarativen Fakten @murre2015replication.

Zum Berechnen dieser optimalen Intervalle werden dabei üblicherweise komplexe Algorithmen verwendet, die mithilfe der Zeitstempel von Lernevents berechnen, wann z.B. eine Vokabel das nächste mal wiederholt werden sollte (c.f. @tabibian2019Enhancinghumanlearningviaspacedre, @2026UnboundedHumanLearning:OptimalSchedulingf).

Es gibt allerdings Kontexte, in denen solche Zeitstempel nicht vorhanden sind — z.B., wenn die Lernende eine analoge Leitner-Box (für Originalkonzept siehe @leitner1972so) verwendet: Hierbei werden die Lernintervalle dadurch "berechnet", dass Lernkarten je nach (Mis)erfolg des Erinnerns in unterschiedliche (physische) Boxen sortiert werden. Hierbei gibt es keine pragmatisch nutzbare Möglichkeit, Zeitstempel für die Lernevents zu erfassen.


Solche analogen Lernmethoden haben allerdings potentielle Vorteile, z.B. im Lichte dessen das handschriftliches Aufschreiben eventuell zu besserem Lernen führt (Diskussion dazu z.B. in @marano2025neuroscience). Manche Lernenden präferieren auch schlicht analoge Lernkarten @zung2022college.

Vor diesem Hintergrund möchte ich untersuchen, wie effektiv Lernitem-Scheduling-Methoden ohne Zeitstempel sein können. Ziel ist es, die folgenden Fragen zu beantworten:

1. Was ist der ideale Algorithmus, um ohne Zeitstempel Zielintervalle für Flashkarten zu berechnen?
2. Wie viel ineffektiver ist dieser Algorithmus im Vergleich zu einem State-of-the-Art zeitstempelbasieren Modell?

Ich möchte hierzu eine algorithmische Simulation durchführen, basierend auf offenen Datensätzen wie @d1 @d2 @d3. Außerdem werde ich mich in bestehende relevante Software wie den `srs-simulator` @2026srs-sim einarbeiten und diese evtl. integrieren.

Als _target measure_ werde ich die durchschnittlich erwartete Erinnerungsrate pro Lernkarte einen Monat in der Zukunft nach einmonatiger Nutzung benutzen (inspiriert von @kim2019Thespacingeffectstandsuptobigdata).

#set text(size: 7pt)

#bibliography("lit.bib")

