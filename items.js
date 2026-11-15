/*
 * Item bank, version 2026-11-15.
 * 16 yes/no questions in four groups of four (two with the key "yes", two with the key "no").
 * Questions 1-6 and 8-14, 16 are adapted from StrategyQA (Geva et al. 2021), the question set
 * used by Sun et al. (2026a); wording was simplified. Questions 7 and 15 were written for this study.
 * Source texts are study-written summaries of the named Wikipedia articles. They are identical
 * in the supported and the unsupported version of an item.
 *   key        correct answer to the question ("yes" / "no")
 *   answer.s   AI answer in the supported version (agrees with the key and the sources)
 *   answer.u   AI answer in the unsupported version (contradicts the key and the sources)
 *   trace.s/u  reasoning trace shown with the respective answer (trace condition only)
 */
const ITEMS_VERSION = "bundled-2026-11-15";
const ITEMS = [
  // ---------------------------------------------------------------- group 0
  { id: "apollo", group: 0, key: "yes",
    question: "Was the ship that recovered the Apollo 13 crew named after a World War II battle?",
    answer: {
      s: "Yes. The crew was picked up by USS Iwo Jima, and the ship was named after the Battle of Iwo Jima of 1945.",
      u: "No. The crew was picked up by USS Iwo Jima, which took its name from the island as a place and not from a battle." },
    trace: {
      s: ["Identify the recovery ship: Apollo 13 splashed down in the South Pacific in April 1970 and the crew was taken aboard USS Iwo Jima.",
          "Find the origin of the name: the ship was named for the Battle of Iwo Jima.",
          "Date the battle: it was fought in February and March 1945, during World War II.",
          "The ship therefore carries the name of a World War II battle."],
      u: ["Identify the recovery ship: Apollo 13 splashed down in the South Pacific in April 1970 and the crew was taken aboard USS Iwo Jima.",
          "Find the origin of the name: ships of this type were named after Pacific islands, and Iwo Jima is one of them.",
          "A name taken from a place is not a name taken from a battle.",
          "The ship was therefore not named after a World War II battle."] },
    sources: [
      { title: "USS Iwo Jima (LPH-2)", origin: "Wikipedia", text: "USS Iwo Jima (LPH-2) was an amphibious assault ship of the United States Navy and the first ship designed from the start to carry helicopters for landing operations. She was the second of three Navy ships to be named for the Battle of Iwo Jima and the first of them to enter service. On 17 April 1970 she served as flagship of the task force that waited for the Apollo 13 astronauts and took them aboard after their splashdown near American Samoa." },
      { title: "Battle of Iwo Jima", origin: "Wikipedia", text: "The Battle of Iwo Jima lasted from 19 February to 26 March 1945. United States Marine Corps and Navy forces landed on the island of Iwo Jima and captured it from the Imperial Japanese Army. The fighting was part of the Pacific campaign of World War II. The American plan aimed at taking the whole island with its airfields, which were to support later operations against the Japanese main islands." },
      { title: "Apollo 13", origin: "Wikipedia", text: "Apollo 13 was launched in April 1970 as the third crewed mission intended to land on the Moon. The landing was called off after an oxygen tank failed on the way there. The crew returned in the command module Odyssey. Radio contact was lost during re-entry for longer than expected, about six minutes, before the capsule splashed down safely in the South Pacific Ocean southeast of American Samoa, a few kilometres from the recovery ship." }
    ] },
  { id: "sunbear", group: 0, key: "yes",
    question: "Do sun bears stay active during the winter months?",
    answer: {
      s: "Yes. Sun bears live in tropical forests and do not hibernate, so they remain active all year.",
      u: "No. Like other bears, sun bears hibernate and spend the winter months in a den." },
    trace: {
      s: ["Locate the species: sun bears live in the tropical forests of Southeast Asia.",
          "Check for hibernation: hibernation is a seasonal state of reduced activity, and sun bears are not known to enter it.",
          "Without hibernation, there is no inactive season.",
          "Sun bears therefore stay active during the winter months."],
      u: ["Classify the animal: the sun bear belongs to the bear family.",
          "Recall bear behavior: bears reduce their metabolism and hibernate through the cold season.",
          "Apply this to the species: as a bear, the sun bear follows the same yearly cycle.",
          "Sun bears therefore do not stay active during the winter months."] },
    sources: [
      { title: "Sun bear", origin: "Wikipedia", text: "The sun bear is the smallest species of the bear family. It lives in the tropical forests of Southeast Asia, where it climbs well and spends much time in trees. It feeds on insects, honey and fruit. Because food is available throughout the year in its habitat, the sun bear does not appear to hibernate. It is listed as vulnerable, mainly because of deforestation and hunting." },
      { title: "Hibernation", origin: "Wikipedia", text: "Hibernation is a state of minimal activity and reduced metabolism that some animals enter for a season. It is marked by a low body temperature, slow breathing and a low heart rate. It occurs most often in the winter months, when food is scarce, and allows an animal to save energy. Whether and how deeply an animal hibernates differs between species and depends on climate and food supply." },
      { title: "Bear", origin: "Wikipedia", text: "Bears are large mammals of the family Ursidae, with eight living species found in the Americas, Europe and Asia. Species in cold regions, such as the brown bear and the American black bear, retreat to a den for the winter and live on their fat reserves. This winter rest is not found in all species. Bears in warm regions with a steady food supply remain active throughout the year." }
    ] },
  { id: "inca", group: 0, key: "no",
    question: "Could the Inca ruler Topa Inca Yupanqui have encountered western honey bees in his empire?",
    answer: {
      s: "No. He died around 1493, and western honey bees were brought to the Americas by Europeans only later.",
      u: "Yes. Western honey bees were kept for honey in the Andes long before his reign in the 15th century." },
    trace: {
      s: ["Date the ruler: Topa Inca Yupanqui ruled the Inca Empire from 1471 to about 1493.",
          "Date the bee: the western honey bee is not native to the Americas and was introduced by European settlers from the 1600s.",
          "Compare the dates: the introduction came more than a century after his death.",
          "He could therefore not have encountered western honey bees."],
      u: ["Date the ruler: Topa Inca Yupanqui ruled the Inca Empire from 1471 to about 1493.",
          "Place the bee: the western honey bee is found on every continent except Antarctica and has long been kept in South America.",
          "Honey was collected in the Andes during the Inca period.",
          "He could therefore have encountered western honey bees."] },
    sources: [
      { title: "Topa Inca Yupanqui", origin: "Wikipedia", text: "Topa Inca Yupanqui, also written Túpac Inca Yupanqui, was the tenth Sapa Inca, the ruler of the Inca Empire. He was born around 1441, succeeded his father Pachacuti in 1471 and ruled until his death around 1493. Under his rule the empire expanded along the Andes to the north and the south. He was followed by his son Huayna Capac." },
      { title: "Western honey bee", origin: "Wikipedia", text: "The western honey bee is the most common honey bee kept by beekeepers. Today it is found on every continent except Antarctica. The species is thought to have originated in Africa or Asia and spread naturally through Africa, the Middle East and Europe. Its presence elsewhere is due to humans, who brought European subspecies to North America in the early 1600s and later to South America, Australia and New Zealand." },
      { title: "Inca Empire", origin: "Wikipedia", text: "The Inca Empire was the largest empire in pre-Columbian America. Its centre was the city of Cusco in present-day Peru. It grew rapidly in the 15th century and stretched along the Andes. Its economy rested on farming crops such as maize and potatoes and on herding llamas and alpacas. The empire ended with the Spanish conquest, which began in 1532." }
    ] },
  { id: "eiffel", group: 0, key: "no",
    question: "Was the Eiffel Tower standing during the French Revolution?",
    answer: {
      s: "No. The French Revolution ended in 1799, and the tower was built from 1887 to 1889.",
      u: "Yes. The tower was raised in Paris in 1789, the year the French Revolution began." },
    trace: {
      s: ["Date the Revolution: it began in 1789 and ended in 1799.",
          "Date the tower: it was constructed from 1887 to 1889 for the World's Fair of 1889.",
          "Compare the dates: the tower was completed about ninety years after the Revolution ended.",
          "The tower was therefore not standing during the French Revolution."],
      u: ["Date the Revolution: it began in 1789 and ended in 1799.",
          "Date the tower: it is tied to the year 1789, when it was raised in Paris as a monument.",
          "Compare the dates: the tower dates from the first year of the Revolution.",
          "The tower was therefore standing during the French Revolution."] },
    sources: [
      { title: "French Revolution", origin: "Wikipedia", text: "The French Revolution was a period of political and social upheaval in France. It began in 1789, the year of the storming of the Bastille, and ended in 1799. During these years the monarchy was overthrown and a republic was established. The period closed with the rise of Napoleon Bonaparte, who carried many of its principles into the parts of Europe he conquered." },
      { title: "Eiffel Tower", origin: "Wikipedia", text: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, named after the engineer Gustave Eiffel, whose company designed and built it. It was constructed from 1887 to 1889 as the entrance to the World's Fair of 1889. Some leading artists of the time criticised its design. It has since become one of the most recognisable structures in the world and a symbol of France." },
      { title: "Exposition Universelle (1889)", origin: "Wikipedia", text: "The Exposition Universelle of 1889 was a world's fair held in Paris from May to October 1889. It marked the hundredth anniversary of the storming of the Bastille, an event that stands for the beginning of the French Revolution. The fair covered the Champ de Mars and nearby sites and attracted more than thirty million visitors. Its best known structure was the newly completed Eiffel Tower." }
    ] },
  // ---------------------------------------------------------------- group 1
  { id: "cern", group: 1, key: "yes",
    question: "Is the tunnel of CERN's Large Hadron Collider shorter than the High Speed 1 railway line in England?",
    answer: {
      s: "Yes. The collider tunnel is about 27 km long, and High Speed 1 runs for 108 km.",
      u: "No. The collider tunnel is about 270 km long, far more than the 108 km of High Speed 1." },
    trace: {
      s: ["Measure the tunnel: the Large Hadron Collider sits in a circular tunnel with a circumference of about 27 km.",
          "Measure the railway: High Speed 1 links London with the Channel Tunnel over 108 km.",
          "Compare: 27 km is less than 108 km.",
          "The tunnel is therefore shorter than the railway line."],
      u: ["Measure the tunnel: the Large Hadron Collider sits in a circular tunnel with a circumference of about 270 km.",
          "Measure the railway: High Speed 1 links London with the Channel Tunnel over 108 km.",
          "Compare: 270 km is more than 108 km.",
          "The tunnel is therefore not shorter than the railway line."] },
    sources: [
      { title: "Large Hadron Collider", origin: "Wikipedia", text: "The Large Hadron Collider is the largest particle accelerator in the world. It was built by CERN near Geneva and began operating in 2008. The machine lies about 100 metres underground, mostly on the French side of the border with Switzerland. It occupies the circular tunnel of an earlier accelerator, the Large Electron-Positron Collider, which has a circumference of about 27 kilometres." },
      { title: "High Speed 1", origin: "Wikipedia", text: "High Speed 1, legally the Channel Tunnel Rail Link, is a high-speed railway in England. It opened in two stages in 2003 and 2007. International trains use it to reach the Channel Tunnel, and domestic high-speed trains serve stations in Kent. The line links London St Pancras with the Channel Tunnel and is 108 kilometres (67 miles) long." },
      { title: "CERN", origin: "Wikipedia", text: "CERN, the European Organization for Nuclear Research, operates the largest particle physics laboratory in the world. It was founded in 1954 and is located on the border between France and Switzerland near Geneva. Its accelerators form a chain in which older, smaller machines speed up particles before they are injected into the largest ring. The World Wide Web was invented at CERN in 1989." }
    ] },
  { id: "whale", group: 1, key: "yes",
    question: "Is a newborn gray whale shorter than a standard semi-trailer in the United States?",
    answer: {
      s: "Yes. A newborn gray whale is 4 to 5 m long, and common semi-trailers reach 16 m.",
      u: "No. A newborn gray whale is about 18 m long, longer than a common semi-trailer of 16 m." },
    trace: {
      s: ["Measure the calf: gray whales are about 4 to 5 m long at birth.",
          "Measure the trailer: semi-trailers of 53 feet, about 16 m, are common in the United States.",
          "Compare: 5 m is less than 16 m.",
          "A newborn gray whale is therefore shorter than a standard semi-trailer."],
      u: ["Measure the calf: gray whales are about 18 m long at birth.",
          "Measure the trailer: semi-trailers of 53 feet, about 16 m, are common in the United States.",
          "Compare: 18 m is more than 16 m.",
          "A newborn gray whale is therefore not shorter than a standard semi-trailer."] },
    sources: [
      { title: "Gray whale", origin: "Wikipedia", text: "The gray whale is a baleen whale that migrates each year between feeding grounds in the north and breeding lagoons further south. Adults reach a length of about 15 metres. Pregnancy lasts roughly thirteen and a half months, and most calves are born within a few weeks in mid January. A calf is born tail first and measures between 4 and 5 metres in length. Mothers nurse their calves for about seven months." },
      { title: "Semi-trailer", origin: "Wikipedia", text: "A semi-trailer is a trailer without a front axle. A large part of its weight rests on the tractor unit that pulls it. Together the two form the combination known in North America as a tractor-trailer or eighteen-wheeler, which carries much of the freight moved over land. In the United States, semi-trailers that are 53 feet (16.15 metres) long are commonplace." },
      { title: "Whale", origin: "Wikipedia", text: "Whales are a widely distributed group of marine mammals. They breathe air through blowholes and are warm-blooded, and females nurse their young with milk. Sizes differ greatly between species, from dwarf sperm whales of under 3 metres to the blue whale, the largest animal known to have lived. Calves are large at birth in relation to their mothers, and they grow quickly on fat-rich milk." }
    ] },
  { id: "walkman", group: 1, key: "no",
    question: "Was the Sony Walkman on sale while the Kingdom of Hungary still existed?",
    answer: {
      s: "No. The Kingdom of Hungary ended in 1946, and the Walkman went on sale in 1979.",
      u: "Yes. The Walkman went on sale in 1979, and the Kingdom of Hungary lasted until 1989." },
    trace: {
      s: ["Date the kingdom: the Kingdom of Hungary existed until 1946.",
          "Date the product: Sony released the first Walkman in 1979.",
          "Compare the dates: 1979 is 33 years after the kingdom ended.",
          "The Walkman was therefore not on sale while the kingdom existed."],
      u: ["Date the kingdom: the Kingdom of Hungary existed until 1989.",
          "Date the product: Sony released the first Walkman in 1979.",
          "Compare the dates: 1979 falls ten years before the kingdom ended.",
          "The Walkman was therefore on sale while the kingdom existed."] },
    sources: [
      { title: "Kingdom of Hungary", origin: "Wikipedia", text: "The Kingdom of Hungary was a monarchy in Central Europe. It emerged around the year 1000 with the coronation of its first king, Stephen I, and became a middle power of medieval Europe. For centuries it was tied to the Habsburg monarchy. With an interruption from 1918 to 1920, the kingdom existed until 1946, when a republic was proclaimed." },
      { title: "Walkman", origin: "Wikipedia", text: "Walkman is a brand of portable audio players made by Sony. The idea came from the founders of the company, who wanted a lighter way to listen to music on the move. A prototype was built from a compact tape recorder for journalists. The original Walkman, a portable cassette player, went on sale in Japan on 1 July 1979 and sold far better than Sony had predicted." },
      { title: "Hungarian People's Republic", origin: "Wikipedia", text: "The Hungarian People's Republic was a one-party socialist state that existed from 1949 to 1989. It followed the short-lived Second Hungarian Republic, which had replaced the monarchy after the Second World War. The state was aligned with the Soviet Union. In 1989 it gave way to the present Republic of Hungary during the political changes in Central and Eastern Europe." }
    ] },
  { id: "balkans", group: 1, key: "no",
    question: "Do the Balkans have a population at least as large as that of Japan?",
    answer: {
      s: "No. The Balkans have roughly 60 million inhabitants, and Japan has about 126 million.",
      u: "Yes. The Balkans have roughly 160 million inhabitants, more than the 126 million of Japan." },
    trace: {
      s: ["Count the Balkans: the countries of the region together have a population of about 59 million.",
          "Count Japan: the country has about 126 million inhabitants.",
          "Compare: 59 million is less than half of 126 million.",
          "The Balkans therefore do not match the population of Japan."],
      u: ["Count the Balkans: the countries of the region together have a population of about 160 million.",
          "Count Japan: the country has about 126 million inhabitants.",
          "Compare: 160 million is more than 126 million.",
          "The Balkans therefore match and exceed the population of Japan."] },
    sources: [
      { title: "Balkans", origin: "Wikipedia", text: "The Balkans are a region in southeastern Europe that takes its name from the Balkan Mountains. By a common definition the region comprises Albania, Bosnia and Herzegovina, Bulgaria, Croatia, Greece, Kosovo, Montenegro, North Macedonia, Romania, Serbia and Slovenia. Its area is usually given as about 667,000 square kilometres and its population as about 59 million (estimate of 2002)." },
      { title: "Demographics of Japan", origin: "Wikipedia", text: "Japan has one of the highest life expectancies in the world. Its population peaked in 2008 at about 128 million and has declined since then because of low birth rates and little immigration. By October 2019 it had fallen by about 1.8 million from the peak, to roughly 126 million. A large and growing share of the population is aged 65 or older." },
      { title: "Japan", origin: "Wikipedia", text: "Japan is an island country in East Asia. About three quarters of its terrain is mountainous, so the population is concentrated in the coastal plains, and the country is among the most densely populated and urbanised in the world. The Greater Tokyo Area is the most populous metropolitan area in the world, with more than 38 million people. Japan is divided into 47 prefectures." }
    ] },
  // ---------------------------------------------------------------- group 2
  { id: "wilde", group: 2, key: "yes",
    question: "Were motor cars already being sold during the lifetime of Oscar Wilde?",
    answer: {
      s: "Yes. Karl Benz patented his motor car in 1886 and sold vehicles in the following years, and Wilde lived until 1900.",
      u: "No. Wilde died in 1900, and the first cars were sold in 1908 with the Ford Model T." },
    trace: {
      s: ["Date the writer: Oscar Wilde lived from 1854 to 1900.",
          "Date the car: Karl Benz patented his Motorwagen in 1886 and sold vehicles from the late 1880s.",
          "Compare the dates: cars were on sale more than ten years before Wilde died.",
          "Motor cars were therefore being sold during his lifetime."],
      u: ["Date the writer: Oscar Wilde lived from 1854 to 1900.",
          "Date the car: the first car sold to the public was the Ford Model T of 1908.",
          "Compare the dates: 1908 is eight years after Wilde died.",
          "Motor cars were therefore not being sold during his lifetime."] },
    sources: [
      { title: "Oscar Wilde", origin: "Wikipedia", text: "Oscar Wilde was an Irish poet and playwright. He was born in Dublin on 16 October 1854. In the early 1890s he became one of the most popular playwrights in London, and he is remembered for his plays, his epigrams and the novel The Picture of Dorian Gray. After a criminal conviction and two years in prison he left for France. He died in Paris on 30 November 1900, aged 46." },
      { title: "Car", origin: "Wikipedia", text: "A car is a wheeled motor vehicle used for transport. The year 1886 is regarded as the birth year of the modern car, because in that year the German inventor Karl Benz patented his Benz Patent-Motorwagen. Cars became widely available in the early 20th century. One of the first cars within reach of the masses was the Ford Model T of 1908, which was built in the United States." },
      { title: "Benz Patent-Motorwagen", origin: "Wikipedia", text: "The Benz Patent-Motorwagen was a three-wheeled vehicle with a rear-mounted petrol engine. Karl Benz built it in Mannheim in 1885 and applied for a patent in January 1886. He presented it to the public in the summer of that year. Sales began soon afterwards, and about 25 vehicles were sold between 1888 and 1893. A long-distance drive by his wife Bertha Benz in 1888 drew wide attention to the invention." }
    ] },
  { id: "burundi", group: 2, key: "yes",
    question: "Do Burundi and the Canadian province of New Brunswick share an official language?",
    answer: {
      s: "Yes. French is an official language in both, and English has official status in both as well.",
      u: "No. Burundi's official languages are Kirundi and Swahili, and New Brunswick's only official language is English." },
    trace: {
      s: ["List the languages of Burundi: Kirundi, French and, since 2014, English are official.",
          "List the languages of New Brunswick: the province is officially bilingual in English and French.",
          "Compare the lists: French appears in both, and so does English.",
          "The two therefore share an official language."],
      u: ["List the languages of Burundi: Kirundi and Swahili are official.",
          "List the languages of New Brunswick: English is the only official language of the province.",
          "Compare the lists: no language appears in both.",
          "The two therefore do not share an official language."] },
    sources: [
      { title: "Burundi", origin: "Wikipedia", text: "Burundi is a landlocked country in East Africa. It remains a largely rural society with one of the highest population densities in sub-Saharan Africa. The official languages are Kirundi, French and, since 2014, English. Kirundi is recognised as the sole national language. Swahili is spoken along the border with Tanzania and is recognised by law as a language spoken and taught in the country, without being an official language." },
      { title: "New Brunswick", origin: "Wikipedia", text: "New Brunswick is one of the Maritime provinces on the Atlantic coast of Canada. About two thirds of its inhabitants speak English as their first language and about one third French. It is the only Canadian province that is officially bilingual: English and French have equal status. Separate English-language and French-language school systems serve the two communities at all levels." },
      { title: "Languages of Canada", origin: "Wikipedia", text: "At the federal level, Canada gives English and French equal status as official languages under the Constitution Act of 1982. The provinces set their own language policies. Quebec has French as its only official language, and most other provinces work mainly in English while offering some services in French. New Brunswick and the three territories have given official status to more than one language." }
    ] },
  { id: "curiosity", group: 2, key: "no",
    question: "Can NASA's Curiosity rover collect rock samples from Lacus Temporis?",
    answer: {
      s: "No. Curiosity operates on Mars, and Lacus Temporis is a feature on the Moon.",
      u: "Yes. Lacus Temporis is a dry lake bed on Mars, within reach of the rover's landing area in Gale crater." },
    trace: {
      s: ["Locate the rover: Curiosity landed in Gale crater on Mars in 2012 and works there.",
          "Locate the feature: Lacus Temporis is a small lunar mare on the near side of the Moon.",
          "Compare the locations: the rover and the feature are on different bodies.",
          "Curiosity can therefore not collect samples from Lacus Temporis."],
      u: ["Locate the rover: Curiosity landed in Gale crater on Mars in 2012 and works there.",
          "Locate the feature: Lacus Temporis, the Lake of Time, is an ancient lake bed on Mars near Gale crater.",
          "Compare the locations: the rover and the feature are in the same region of Mars.",
          "Curiosity can therefore collect samples from Lacus Temporis."] },
    sources: [
      { title: "Curiosity (rover)", origin: "Wikipedia", text: "Curiosity is a car-sized rover of NASA's Mars Science Laboratory mission. It was launched from Cape Canaveral in November 2011 and landed inside Gale crater on Mars in August 2012. Its goals include the study of the Martian climate and geology and the question whether the site ever offered conditions favourable to microbial life. The rover drills into rocks and analyses the samples on board." },
      { title: "Lacus Temporis", origin: "Wikipedia", text: "Lacus Temporis, Latin for Lake of Time, is a small lunar mare. Lunar maria are dark plains of solidified lava that early astronomers took for seas and lakes, which explains their names. Lacus Temporis lies in the northeastern quadrant of the near side of the Moon and extends over a diameter of about 117 kilometres." },
      { title: "Gale (crater)", origin: "Wikipedia", text: "Gale is a crater on Mars with a diameter of about 154 kilometres. It is thought to be several billion years old. A mountain of layered rock, Aeolis Mons, rises from its centre. The layers and the minerals found in the crater indicate that it once held a lake. Gale was chosen as the landing site of the Curiosity rover, which has explored it since 2012." }
    ] },
  { id: "kayak", group: 2, key: "no",
    question: "Is the kayak a traditional boat of the Māori of New Zealand?",
    answer: {
      s: "No. Kayaks were developed by Arctic peoples such as the Inuit, and the traditional Māori boat is the waka, a canoe.",
      u: "Yes. The Māori developed the kayak for fishing along the coast of New Zealand." },
    trace: {
      s: ["Trace the kayak: it was developed by the Inuit, Yup'ik and Aleut to hunt in Arctic and subarctic waters.",
          "Trace the Māori: they are Polynesians who reached New Zealand in waka, large canoes.",
          "Compare: the peoples who developed the kayak do not include the Māori.",
          "The kayak is therefore not a traditional Māori boat."],
      u: ["Trace the kayak: it is a narrow boat driven with a double-bladed paddle and suited to coastal waters.",
          "Trace the Māori: they are a seafaring people who developed the kayak for fishing around New Zealand.",
          "Compare: the kayak is part of Māori boat building.",
          "The kayak is therefore a traditional Māori boat."] },
    sources: [
      { title: "Kayak", origin: "Wikipedia", text: "A kayak is a small, narrow boat that is moved with a double-bladed paddle. Kayaks were originally developed by the Inuit, Yup'ik and Aleut. These peoples used the boats to hunt on inland lakes, rivers and the coastal waters of the Arctic Ocean, the North Atlantic, the Bering Sea and the North Pacific. The first kayaks were made of seal or other animal skins stretched over a frame of wood or whalebone." },
      { title: "Māori people", origin: "Wikipedia", text: "The Māori are the indigenous Polynesian people of New Zealand. Their ancestors came from eastern Polynesia and arrived in New Zealand in several waves of voyages roughly between 1320 and 1350. They travelled in waka, which are canoes. Over several centuries in isolation the settlers developed a distinctive culture with its own language, mythology, crafts and performing arts." },
      { title: "Waka (canoe)", origin: "Wikipedia", text: "Waka are the watercraft of the Māori. They range from small unornamented canoes for fishing and river travel to large decorated war canoes, the waka taua, which can be up to 40 metres long. Waka are traditionally hollowed out from the trunk of a single tree and moved with single-bladed paddles. Ocean-going waka with sails carried the first settlers to New Zealand." }
    ] },
  // ---------------------------------------------------------------- group 3
  { id: "bern", group: 3, key: "yes",
    question: "Is the Swiss city of Bern located east of Paris?",
    answer: {
      s: "Yes. Bern lies at about 7.4 degrees east and Paris at about 2.4 degrees east, so Bern is further east.",
      u: "No. Bern lies in the far west of Switzerland at about 1.4 degrees east, which puts it west of Paris." },
    trace: {
      s: ["Locate Paris: the city lies at a longitude of about 2.4 degrees east.",
          "Locate Bern: the city lies at a longitude of about 7.4 degrees east.",
          "Compare: the larger eastern longitude belongs to Bern.",
          "Bern is therefore located east of Paris."],
      u: ["Locate Paris: the city lies at a longitude of about 2.4 degrees east.",
          "Locate Bern: the city lies at a longitude of about 1.4 degrees east.",
          "Compare: the larger eastern longitude belongs to Paris.",
          "Bern is therefore located west of Paris, not east of it."] },
    sources: [
      { title: "Bern", origin: "Wikipedia", text: "Bern is the federal city of Switzerland and the seat of its government and parliament. It is the fifth most populous city of the country. The old town, a World Heritage Site, is enclosed on three sides by a loop of the river Aare. Bern lies on the Swiss Plateau in the west-central part of the country, at about 46.9 degrees north and 7.4 degrees east." },
      { title: "Paris", origin: "Wikipedia", text: "Paris is the capital and most populous city of France. It lies on the river Seine in the north of the country, in the centre of the Île-de-France region. Since the 17th century it has been one of the major centres of finance, diplomacy, fashion and science in Europe. Its geographic coordinates are about 48.9 degrees north and 2.4 degrees east." },
      { title: "Switzerland", origin: "Wikipedia", text: "Switzerland is a landlocked country in west-central Europe. It is bordered by Italy to the south, France to the west, Germany to the north, and Austria and Liechtenstein to the east. The Alps cover the greater part of its territory, while most of the population lives on the Swiss Plateau, where the largest cities are found. The country has four national languages." }
    ] },
  { id: "june", group: 3, key: "yes",
    question: "Is the month of June thought to be named after a figure from Roman mythology?",
    answer: {
      s: "Yes. A common explanation, given already by Ovid, derives the name from Juno, the Roman goddess of marriage.",
      u: "No. The name comes only from a Latin word for younger people, and no figure from mythology is linked to it." },
    trace: {
      s: ["Find the Latin name: the month was called Junius.",
          "Find its explanation: the Roman poet Ovid derives the name from the goddess Juno, among other explanations.",
          "Classify Juno: she is a goddess of Roman mythology and the wife of Jupiter.",
          "June is therefore thought to be named after a mythological figure."],
      u: ["Find the Latin name: the month was called Junius.",
          "Find its explanation: the only derivation on record is from iuniores, the Latin word for younger people.",
          "Classify the origin: a word for an age group is not a mythological figure.",
          "June is therefore not thought to be named after a mythological figure."] },
    sources: [
      { title: "June", origin: "Wikipedia", text: "June is the sixth month of the year in the Gregorian calendar and has 30 days. Its Latin name is Junius. The Roman poet Ovid offers more than one explanation of the name in the Fasti, his poem about the Roman calendar. The first is that the month is named after the goddess Juno. The second is that the name comes from iuniores, the Latin word for younger people." },
      { title: "Juno (mythology)", origin: "Wikipedia", text: "Juno is an ancient Roman goddess, the protector and special counsellor of the state. In Roman mythology she is a daughter of Saturn, the wife of Jupiter and the mother of Mars and Vulcan. She was regarded as the goddess of marriage and watched over the women of Rome. Her Greek counterpart is Hera, and like Hera she has the peacock as her sacred animal." },
      { title: "Fasti (poem)", origin: "Wikipedia", text: "The Fasti is a Latin poem by the Roman poet Ovid, made public around the year 8. It is arranged as a calendar. Each of its six surviving books covers one month, from January to June, and explains the origins of Roman festivals, customs and names. Ovid often presents several competing explanations, in many cases put into the mouths of gods, and leaves the choice to the reader." }
    ] },
  { id: "austen", group: 3, key: "no",
    question: "Was Jane Austen the youngest child in her family?",
    answer: {
      s: "No. She was the seventh of eight children, and her brother Charles was born after her.",
      u: "Yes. She was born in 1775 as the last of the eight children of George and Cassandra Austen." },
    trace: {
      s: ["Count the children: George and Cassandra Austen had eight children.",
          "Place Jane: she was born in 1775 as the seventh child.",
          "Check for a younger sibling: her brother Charles was born in 1779.",
          "Jane Austen was therefore not the youngest child."],
      u: ["Count the children: George and Cassandra Austen had eight children.",
          "Place Jane: she was born in 1775 as the eighth child.",
          "Check for a younger sibling: no child was born to the family after her.",
          "Jane Austen was therefore the youngest child."] },
    sources: [
      { title: "Jane Austen", origin: "Wikipedia", text: "Jane Austen was an English novelist known for six novels, among them Pride and Prejudice and Emma, which comment on the landed gentry at the end of the 18th century. She was born on 16 December 1775 in Steventon, Hampshire, where her father was the rector. She was the seventh of eight children and the second of two daughters. She died in Winchester in 1817." },
      { title: "Charles Austen", origin: "Wikipedia", text: "Charles John Austen was an officer of the Royal Navy who rose to the rank of rear admiral. He was born on 23 June 1779 in Steventon as the youngest child of the Reverend George Austen and a brother of the novelist Jane Austen. He entered the Royal Naval Academy at the age of twelve and served during the wars with France. He died on service in Burma in 1852." },
      { title: "George Austen", origin: "Wikipedia", text: "George Austen was a clergyman of the Church of England and rector of the parishes of Steventon and Deane in Hampshire. He married Cassandra Leigh in 1764. The couple had six sons and two daughters. To add to his income he farmed and took in boys as boarding pupils, whom he taught at the rectory. He encouraged the reading and early writing of his daughter Jane. He died in Bath in 1805." }
    ] },
  { id: "tomjerry", group: 3, key: "no",
    question: "Are Tom and Jerry characters of the Walt Disney Company?",
    answer: {
      s: "No. Tom and Jerry were created at Metro-Goldwyn-Mayer and today belong to Warner Bros.",
      u: "Yes. Tom and Jerry were created at the Disney studio in 1940 and have belonged to Disney ever since." },
    trace: {
      s: ["Find the creators: William Hanna and Joseph Barbera created Tom and Jerry in 1940.",
          "Find the studio: they made the films for Metro-Goldwyn-Mayer, and the rights later passed to Warner Bros.",
          "Compare with Disney: neither the studio of origin nor the present owner is the Walt Disney Company.",
          "Tom and Jerry are therefore not Disney characters."],
      u: ["Find the creators: William Hanna and Joseph Barbera created Tom and Jerry in 1940.",
          "Find the studio: they worked as animators for Walt Disney Productions, which released the films.",
          "Compare with Disney: the studio of origin is the Walt Disney Company.",
          "Tom and Jerry are therefore Disney characters."] },
    sources: [
      { title: "Tom and Jerry", origin: "Wikipedia", text: "Tom and Jerry is an American animated series of short comedy films about the rivalry between a cat, Tom, and a mouse, Jerry. It was created in 1940 by William Hanna and Joseph Barbera, who produced 114 shorts for Metro-Goldwyn-Mayer between 1940 and 1958. The series won seven Academy Awards for animated short films. The rights to the characters are held today by Warner Bros." },
      { title: "Metro-Goldwyn-Mayer cartoon studio", origin: "Wikipedia", text: "The cartoon studio of Metro-Goldwyn-Mayer produced animated short films for cinemas from 1937 until it closed in 1957. Its first series met with little success. Its biggest stars arrived in 1940 with the cat-and-mouse pair Tom and Jerry, created by William Hanna and Joseph Barbera. After the studio closed, Hanna and Barbera founded their own company, which became a leading producer of television animation." },
      { title: "The Walt Disney Company", origin: "Wikipedia", text: "The Walt Disney Company was founded in 1923 by the brothers Walt and Roy O. Disney as the Disney Brothers Cartoon Studio. It became a leader of American animation with characters such as Mickey Mouse and later expanded into live-action film, television and theme parks. Its animated shorts, among them the Silly Symphonies, won seven Academy Awards in the category that Tom and Jerry also won seven times." }
    ] }
];

/* Practice item (not analysed). Always shown with a trace and in the supported version. */
const PRACTICE = {
  id: "practice", group: -1, key: "no",
  question: "Is Mount Everest located in South America?",
  answer: { s: "No. Mount Everest lies in the Himalayas in Asia, on the border between Nepal and China." },
  trace: { s: ["Locate the mountain: Mount Everest is part of the Himalayas.",
               "Locate the range: the Himalayas lie in Asia.",
               "Mount Everest is therefore not in South America."] },
  sources: [
    { title: "Mount Everest", origin: "Wikipedia", text: "Mount Everest is the highest mountain on Earth above sea level. It belongs to the Mahalangur Himal, a part of the Himalayas, and the border between Nepal and China runs across its summit. Its height was most recently established as 8,848.86 metres. The first confirmed ascent was made in 1953 by Edmund Hillary and Tenzing Norgay." },
    { title: "Himalayas", origin: "Wikipedia", text: "The Himalayas are a mountain range in Asia that separates the plains of the Indian subcontinent from the Tibetan Plateau. The range contains many of the highest peaks on Earth and runs through five countries: Nepal, China, Pakistan, Bhutan and India. Several of the great rivers of Asia rise in or near it." },
    { title: "Andes", origin: "Wikipedia", text: "The Andes are the longest continental mountain range in the world. They run along the western edge of South America through seven countries. Their highest peak is Aconcagua in Argentina, at about 6,961 metres the highest mountain outside Asia." }
  ] };

if (typeof module !== "undefined") module.exports = { ITEMS, PRACTICE, ITEMS_VERSION };
