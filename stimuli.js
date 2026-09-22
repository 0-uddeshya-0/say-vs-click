/*
 * Stimuli for the trust–verification gap experiment.
 *
 * Schema:
 *   practice / trials[] entries:
 *     id                unique trial id
 *     claim             factual claim the participant evaluates
 *     claimTrue         real-world truth of the claim (for analysis)
 *     answerText        the AI assistant's verdict + one-line basis (constant across variants)
 *     rationaleCorrect  3–5 valid reasoning steps
 *     rationaleFlawed   same length; contains exactly one invalid step
 *                       (flawType records the flaw category)
 *     certaintyMarkers  marker sentence appended per certainty condition
 *     sourcesSupported  excerpts that DO entail the answer
 *     sourcesUnsupported topically-plausible excerpts that do NOT entail the answer
 *   Runtime assigns, per participant: rationale variant (2 of 6 trials flawed) and
 *   source variant (2 of 6 trials unsupported), independently randomized.
 *
 * Source excerpts are study-authored encyclopedic texts (simulated sources), not
 * verbatim web pages; supported variants contain sufficient entailment evidence.
 */

const STIMULI = {
  practice: {
    id: "practice",
    claim: "Botanically speaking, bananas are classified as berries.",
    claimTrue: true,
    answerText:
      "This claim is accurate. Bananas meet the botanical definition of a berry: they develop from a single flower with a single ovary and have a fleshy interior without a stone.",
    rationaleCorrect: [
      "A botanical berry develops from a single ovary of a single flower.",
      "A berry has a soft, fleshy pericarp and typically contains several seeds.",
      "Bananas develop from one flower with one ovary and have a fleshy inside.",
      "Therefore bananas satisfy the botanical definition of a berry."
    ],
    rationaleFlawed: [
      "A botanical berry develops from a single ovary of a single flower.",
      "A berry has a soft, fleshy pericarp and typically contains several seeds.",
      "Bananas are commonly eaten as a sweet fruit in many countries.",
      "Therefore bananas satisfy the botanical definition of a berry."
    ],
    flawType: "non-sequitur (true but irrelevant premise)",
    certaintyMarkers: {
      certain: "The evidence clearly supports this conclusion.",
      uncertain: "The available evidence is limited, so this conclusion may be incomplete."
    },
    sourcesSupported: [
      {
        label: "Source 1",
        title: "Botanical glossary: fruit types",
        excerpt:
          "In botanical terminology, a berry is a fleshy fruit produced from a single ovary of a single flower. The entire pericarp is soft, and the seeds are embedded in the flesh. By this definition, grapes, tomatoes, and bananas are berries, whereas strawberries and raspberries are not."
      },
      {
        label: "Source 2",
        title: "Banana (Musa spp.) — plant profile",
        excerpt:
          "The banana plant produces a large hanging cluster of fruit. Each banana develops from a single ovary, which is why botanists classify the banana fruit as a berry despite its size and shape."
      }
    ],
    sourcesUnsupported: [
      {
        label: "Source 1",
        title: "Banana cultivation worldwide",
        excerpt:
          "Bananas are grown in more than 150 countries and rank among the most consumed fruits globally. India is the largest producer, followed by China. Most exported bananas belong to the Cavendish subgroup."
      },
      {
        label: "Source 2",
        title: "A short history of the banana trade",
        excerpt:
          "Bananas reached international markets in the late nineteenth century with the spread of refrigerated shipping. The fruit's popularity transformed agricultural economies across Central America."
      }
    ]
  },

  trials: [
    {
      id: "t1_sharks",
      claim: "Sharks existed as a group before trees did.",
      claimTrue: true,
      answerText:
        "This claim is accurate. The earliest sharks appear in the fossil record roughly 450 million years ago, while the earliest true trees appeared roughly 350–390 million years ago.",
      rationaleCorrect: [
        "Fossil evidence places the earliest shark-like fishes around 450 million years ago.",
        "The earliest true trees, such as Archaeopteris, appeared around 350–390 million years ago.",
        "450 million years predates 350–390 million years.",
        "Therefore sharks predate trees."
      ],
      rationaleFlawed: [
        "Fossil evidence places the earliest shark-like fishes around 450 million years ago.",
        "The earliest true trees, such as Archaeopteris, appeared around 350–390 million years ago.",
        "Sharks have survived all five major mass extinction events.",
        "Therefore sharks predate trees."
      ],
      flawType: "non-sequitur (survival claim does not establish earlier origin)",
      certaintyMarkers: {
        certain: "The evidence clearly supports this conclusion.",
        uncertain: "The available evidence is limited, so this conclusion may be incomplete."
      },
      sourcesSupported: [
        {
          label: "Source 1",
          title: "Timeline of vertebrate evolution",
          excerpt:
            "The earliest recognizable sharks appear in the fossil record during the Late Ordovician to Early Silurian, approximately 450 million years ago. True trees appeared later, with Archaeopteris forests established by the Late Devonian, about 350–390 million years ago."
        },
        {
          label: "Source 2",
          title: "Archaeopteris: the first modern tree",
          excerpt:
            "Archaeopteris, generally regarded as the earliest true tree, spread through Devonian floodplains around 385 million years ago — tens of millions of years after sharks had already diversified in the oceans."
        }
      ],
      sourcesUnsupported: [
        {
          label: "Source 1",
          title: "Shark diversity today",
          excerpt:
            "More than 500 living shark species occupy habitats from shallow reefs to the deep sea. Modern sharks range in size from the 17-centimetre dwarf lanternshark to the 12-metre whale shark."
        },
        {
          label: "Source 2",
          title: "How trees shape the climate",
          excerpt:
            "Forest canopies regulate regional temperatures and store large amounts of carbon. The expansion of forests changed atmospheric composition over geological time."
        }
      ]
    },
    {
      id: "t2_honey",
      claim: "Edible honey has been recovered from ancient Egyptian tombs thousands of years old.",
      claimTrue: true,
      answerText:
        "This claim is accurate. Archaeologists have recovered pots of honey from Egyptian tombs dated to roughly 3,000 years ago, and the honey was found to remain edible because honey's low water content and acidity inhibit spoilage.",
      rationaleCorrect: [
        "Egyptian tomb excavations have uncovered sealed vessels containing honey.",
        "Several finds date to about 3,000 years ago.",
        "Honey's low water activity and acidity inhibit microbial growth.",
        "Reports describe the recovered honey as still edible.",
        "Therefore the claim is supported."
      ],
      rationaleFlawed: [
        "Egyptian tomb excavations have uncovered sealed vessels containing honey.",
        "Several finds date to about 3,000 years ago.",
        "Honey was widely used in Egypt for food, medicine, and offerings.",
        "Therefore the recovered honey remained edible."
      ],
      flawType: "unsupported conclusion (usage in antiquity does not entail present edibility)",
      certaintyMarkers: {
        certain: "The evidence clearly supports this conclusion.",
        uncertain: "The available evidence is limited, so this conclusion may be incomplete."
      },
      sourcesSupported: [
        {
          label: "Source 1",
          title: "Honey in Egyptian funerary practice",
          excerpt:
            "Excavations of Egyptian tombs, including finds dated to roughly 3,000 years ago, have recovered jars of honey placed as offerings. Analysis of these finds repeatedly reported the honey as preserved and edible, a result of honey's low water content and acidic pH."
        },
        {
          label: "Source 2",
          title: "Why honey resists spoilage",
          excerpt:
            "Honey's low water activity, acidity (pH 3–4.5), and hydrogen-peroxide content suppress microbial growth, allowing sealed honey to remain edible for extraordinarily long periods."
        }
      ],
      sourcesUnsupported: [
        {
          label: "Source 1",
          title: "Honey in Egyptian funerary practice",
          excerpt:
            "Honey held an important place in Egyptian ritual and medicine. Tomb inventories list honey among offerings, and temple records show it was presented to deities."
        },
        {
          label: "Source 2",
          title: "Composition of honey",
          excerpt:
            "Honey consists mainly of fructose and glucose with trace enzymes, minerals, and aromatic compounds. Its composition varies with the flowers visited by the bees."
        }
      ]
    },
    {
      id: "t3_venus",
      claim: "A day on Venus lasts longer than a year on Venus.",
      claimTrue: true,
      answerText:
        "This claim is accurate. Venus takes about 243 Earth days to complete one rotation on its axis, but only about 225 Earth days to complete one orbit around the Sun.",
      rationaleCorrect: [
        "One orbit of Venus around the Sun takes about 225 Earth days.",
        "One rotation of Venus on its axis takes about 243 Earth days.",
        "243 Earth days is longer than 225 Earth days.",
        "Therefore a Venusian sidereal day exceeds a Venusian year."
      ],
      rationaleFlawed: [
        "One orbit of Venus around the Sun takes about 225 Earth days.",
        "One rotation of Venus on its axis takes about 243 Earth days.",
        "Venus rotates in the opposite direction to most planets, so its sun rises in the west.",
        "Therefore a Venusian sidereal day exceeds a Venusian year."
      ],
      flawType: "non-sequitur (retrograde direction does not establish relative duration)",
      certaintyMarkers: {
        certain: "The evidence clearly supports this conclusion.",
        uncertain: "The available evidence is limited, so this conclusion may be incomplete."
      },
      sourcesSupported: [
        {
          label: "Source 1",
          title: "Venus: planetary fact sheet",
          excerpt:
            "Venus completes one orbit of the Sun every 224.7 Earth days. Its rotation period is about 243 Earth days and is retrograde — making Venus's day longer than its year, a unique case among the major planets."
        },
        {
          label: "Source 2",
          title: "The slow spin of Venus",
          excerpt:
            "Radar measurements show Venus rotates once every 243 Earth days. Because its orbital period is shorter, a single rotation outlasts a complete trip around the Sun."
        }
      ],
      sourcesUnsupported: [
        {
          label: "Source 1",
          title: "Venus: planetary fact sheet",
          excerpt:
            "Venus is the second planet from the Sun and Earth's closest planetary neighbour. Its dense carbon-dioxide atmosphere produces surface pressures about 92 times Earth's and temperatures near 465 °C."
        },
        {
          label: "Source 2",
          title: "Why Venus rotates backwards",
          excerpt:
            "Venus's retrograde rotation — opposite to most planets — may result from ancient impacts or tidal torques from its thick atmosphere. The retrograde spin causes the Sun to rise in the west on Venus."
        }
      ]
    },
    {
      id: "t4_wallmoon",
      claim: "The Great Wall of China is visible from the Moon with the naked eye.",
      claimTrue: false,
      answerText:
        "This claim is not accurate. Astronauts have consistently reported that the Great Wall cannot be seen from the Moon; it is far too narrow, and its materials blend into the surrounding terrain.",
      rationaleCorrect: [
        "The Moon is about 384,000 km from Earth.",
        "The Great Wall is only a few metres wide and its colour resembles local soil and rock.",
        "Resolving such an object from lunar distance would exceed the eye's resolving power.",
        "Astronaut accounts confirm the Wall is not visible from the Moon.",
        "Therefore the claim is false."
      ],
      rationaleFlawed: [
        "The Moon is about 384,000 km from Earth.",
        "The Great Wall is the longest structure ever built by humans.",
        "Astronauts often photograph Earth from orbit.",
        "Therefore the claim that the Wall is visible from the Moon is false."
      ],
      flawType: "non-sequitur (length and orbital photography do not bear on lunar-distance visibility)",
      certaintyMarkers: {
        certain: "The evidence clearly supports this conclusion.",
        uncertain: "The available evidence is limited, so this conclusion may be incomplete."
      },
      sourcesSupported: [
        {
          label: "Source 1",
          title: "Visibility of Earth structures from space",
          excerpt:
            "NASA states that no human-made object, including the Great Wall of China, is visible to the unaided eye from the Moon. The claim likely originated before the space age; Apollo astronauts confirmed that only continental-scale features are discernible."
        },
        {
          label: "Source 2",
          title: "Great Wall dimensions",
          excerpt:
            "The Great Wall's width averages only a few metres, and its stone and packed-earth surfaces closely match the colour of the surrounding landscape — properties that make it effectively invisible even from low Earth orbit without magnification."
        }
      ],
      sourcesUnsupported: [
        {
          label: "Source 1",
          title: "The Great Wall through history",
          excerpt:
            "Built and rebuilt over two millennia, the Great Wall network stretches more than 20,000 km across northern China. Most surviving sections date to the Ming dynasty."
        },
        {
          label: "Source 2",
          title: "Humanity seen from the Moon",
          excerpt:
            "Apollo astronauts described Earth as a blue-and-white marble against black space. Cloud systems, oceans, and continents dominate the view from lunar distance."
        }
      ]
    },
    {
      id: "t5_sahara",
      claim: "The Sahara is the largest desert on Earth.",
      claimTrue: false,
      answerText:
        "This claim is not accurate. The Sahara is the largest hot desert, but the Antarctic Desert — a polar desert — is larger in total area.",
      rationaleCorrect: [
        "Deserts are defined by very low precipitation, not by temperature.",
        "The Sahara covers about 9.2 million km².",
        "The Antarctic Desert covers about 14 million km² of near-zero precipitation.",
        "Therefore the Sahara is not the largest desert overall."
      ],
      rationaleFlawed: [
        "Deserts are defined by very low precipitation, not by temperature.",
        "The Sahara is famous for record high temperatures and vast sand seas.",
        "Most people associate the word 'desert' with hot, sandy landscapes.",
        "Therefore the Sahara is not the largest desert on Earth."
      ],
      flawType: "non-sequitur (popular association does not bear on area ranking)",
      certaintyMarkers: {
        certain: "The evidence clearly supports this conclusion.",
        uncertain: "The available evidence is limited, so this conclusion may be incomplete."
      },
      sourcesSupported: [
        {
          label: "Source 1",
          title: "What counts as a desert",
          excerpt:
            "Deserts are regions receiving very low annual precipitation, conventionally under about 250 mm. Under this definition the two largest deserts are polar: the Antarctic Desert (≈14.2 million km²) and the Arctic Desert (≈13.9 million km²), followed by the Sahara (≈9.2 million km²), the largest hot desert."
        },
        {
          label: "Source 2",
          title: "Sahara area and extent",
          excerpt:
            "The Sahara covers roughly 9.2 million km² across North Africa, making it the largest hot desert but third overall when polar deserts are included."
        }
      ],
      sourcesUnsupported: [
        {
          label: "Source 1",
          title: "The Sahara's shifting climate",
          excerpt:
            "The Sahara has alternated between arid desert and greener savanna over millennia. During African humid periods, lakes and grasslands supported wildlife and human settlement."
        },
        {
          label: "Source 2",
          title: "Iconic deserts of the world",
          excerpt:
            "The Sahara is renowned for dunes reaching 180 m and temperature extremes above 50 °C. Other famous deserts include the Gobi, Atacama, and Arabian deserts."
        }
      ]
    },
    {
      id: "t6_dinosaurs",
      claim: "Early humans and non-bird dinosaurs lived at the same time.",
      claimTrue: false,
      answerText:
        "This claim is not accurate. Non-bird dinosaurs went extinct about 66 million years ago, while the earliest members of the human lineage appeared only within the last several million years — a gap of roughly 60 million years.",
      rationaleCorrect: [
        "Non-bird dinosaurs went extinct about 66 million years ago at the end of the Cretaceous.",
        "The earliest hominins appear only around 6–7 million years ago, and Homo sapiens about 300,000 years ago.",
        "A gap of roughly 60 million years separates the two groups.",
        "Therefore humans and non-bird dinosaurs did not coexist."
      ],
      rationaleFlawed: [
        "Non-bird dinosaurs went extinct about 66 million years ago at the end of the Cretaceous.",
        "Dinosaur fossils have been found on every continent, including Antarctica.",
        "A gap of roughly 60 million years separates the two groups.",
        "Therefore humans and dinosaurs did not coexist."
      ],
      flawType: "irrelevant premise (fossil distribution does not bear on chronology)",
      certaintyMarkers: {
        certain: "The evidence clearly supports this conclusion.",
        uncertain: "The available evidence is limited, so this conclusion may be incomplete."
      },
      sourcesSupported: [
        {
          label: "Source 1",
          title: "The end-Cretaceous extinction",
          excerpt:
            "Non-bird dinosaurs disappeared in the end-Cretaceous mass extinction about 66 million years ago, most likely triggered by a major asteroid impact at Chicxulub."
        },
        {
          label: "Source 2",
          title: "Timeline of human evolution",
          excerpt:
            "The earliest hominins appear in the fossil record around 6–7 million years ago; Homo sapiens emerged roughly 300,000 years ago — about 60 million years after non-bird dinosaurs went extinct."
        }
      ],
      sourcesUnsupported: [
        {
          label: "Source 1",
          title: "Where dinosaur fossils are found",
          excerpt:
            "Dinosaur fossils occur on every continent, from the badlands of North America to Antarctic sediments. Famous formations include the Morrison Formation and the Gobi Desert sites."
        },
        {
          label: "Source 2",
          title: "What killed the dinosaurs",
          excerpt:
            "The leading explanation for the end-Cretaceous extinction is an asteroid impact, with volcanism and climate change as contributing factors. Birds are the surviving dinosaur lineage."
        }
      ]
    }
  ]
};

// Questionnaire content (post-trial), grouped for clarity.
const QUESTIONNAIRE = {
  situationalTrust: [
    "The assistant's answers were reliable.",
    "I could depend on the assistant to be accurate.",
    "The assistant's reasoning was transparent to me.",
    "I would trust this assistant for important factual questions.",
    "The assistant's citations were helpful.",
    "Overall, I trust this AI assistant."
  ],
  aiLiteracy: [
    "I understand how AI systems like chatbots generate answers.",
    "I can judge when an AI answer might be wrong.",
    "I know that AI systems can cite sources incorrectly.",
    "I am familiar with how AI tools present sources or evidence.",
    "I feel confident evaluating AI-generated content."
  ],
  habitualCheck:
    "When you use AI chatbots or assistants, how often do you check the sources or references they provide?",
  funnel: "What do you think this study was about?",
  demographics: ["Age", "Gender"]
};

if (typeof module !== "undefined") module.exports = { STIMULI, QUESTIONNAIRE };
