# Rapport: AI-driven Mindmap-generering i Span

## Inledning

Span är en lokal, desktop-baserad applikation för visuellt tänkande som bygger på ett oändligt canvas där användare kan skapa noder och kopplingar för att utforska idéer rumsligt. Applikationen är byggd med Electron, React och Konva, och sparar projekt som JSON-filer för maximal portabilitet och integritet.

Denna rapport fokuserar på utvecklingen av en AI-funktion som automatiskt genererar mindmaps från dokument genom att använda Large Language Models (LLM) för att identifiera hierarkisk struktur och extrahera meningsfullt innehåll.

### Hur kan AI bevara dokumentstruktur samt skapa användbarhet genom mindmap-generering från text?

Detta är den centrala forskningsfrågan som undersöks i projektet. Genom att kombinera dokumentanalys, LLM-baserad hierarkiidentifiering och automatisk layout via kod, kan systemet transformera linjära dokument till interaktiva visuella representationer som bevarar den ursprungliga strukturen samtidigt som de ökar användbarheten genom spatial organisering och visuell översikt.

---

## Teori

### Exempel: LLM (Large Language Models)

Large Language Models är transformer-baserade neurala nätverk som har tränats på stora mängder textdata för att förstå och generera mänskligt språk. I detta projekt används Ollama med modellen `Gemma3:1b` - en lokal, lättviktsmodell som körs på användarens dator för att säkerställa integritet och eliminera beroende av externa API:er.

LLM:er kan analysera dokumentstruktur genom att:
- Identifiera hierarkiska relationer mellan sektioner
- Extrahera nyckelbegrepp och sammanfatta innehåll
- Generera strukturerade svar i JSON-format för programmatisk bearbetning

**Relevans för projektet:** LLM används för att analysera segmenterade dokument och bygga en trädstruktur som representerar dokumentets hierarki, samt för att generera korta titlar och bullet points för varje nod i mindmappen.

### Exempel: Embedding

Embeddings är vektorepresentationer av text som fångar semantisk likhet. Medan embeddings inte är huvudfokus i detta MVP, kan de i framtida iterationer användas för:
- Att gruppera liknande noder
- Att identifiera tematiskt relaterat innehåll
- Att förbättra layout genom att placera semantiskt närliggande noder närmare varandra

**Relevans för projektet:** Embeddings kan potentiellt användas för att förbättra layout-algoritmen genom att ta hänsyn till semantisk närhet, inte bara hierarkisk struktur.

### Exempel: Bibliotek

Projektet använder flera viktiga bibliotek:

- **pdf2json**: För att extrahera textinnehåll från PDF-dokument med bevarande av grundläggande struktur (rubriker, stycken). Valdes efter att ha testat `pdf-parse` och `pdfjs-dist` som inte fungerade i Electron-miljön.
- **Ollama API**: Lokal LLM-tjänst som tillhandahåller REST API för att interagera med `gemma3:1b`-modellen
- **React + react-konva**: För rendering av canvas och interaktiva noder
- **Electron**: För desktop-applikation med filsystemåtkomst

**Relevans för projektet:** Dessa bibliotek möjliggör hela pipeline: från PDF-extraktion, via LLM-analys, till visuell rendering på canvas.

### Exempel: Nyckel-delar i koden

**Dokumentparsing (`documentParser.ts`):**
- Segmenterar dokument i logiska enheter (kapitel, sektioner, stycken)
- Identifierar hierarkiska nivåer baserat på markdown-rubriker eller PDF-formatering
- Skapar `DocumentSegment`-objekt med metadata om nivå och typ

**LLM-klient (`llmClient.ts`):**
- Hanterar kommunikation med Ollama API
- Skickar prompts för hierarkiidentifiering och innehållsextraktion
- Parserar JSON-svar från modellen till strukturerade träd

**Layout-motor (`layoutEngine.ts`):**
- Implementerar hierarkisk trädlayout (top-down, förälder ovanför barn)
- Beräknar positioner för noder baserat på hierarkisk struktur
- Hanterar spacing och centrering för läsbarhet

**Hierarki-builder (`hierarchyBuilder.ts`):**
- Konverterar platta segment till hierarkiska trädstrukturer
- Validerar trädstruktur och hanterar edge cases (orphaned nodes, circular dependencies)
- Beräknar trädstatistik (totala noder, maxdjup, noder per nivå)

**AI-generering (`useAIGeneration.ts`):**
- Orkestrerar hela genereringsprocessen (hierarkiidentifiering → innehållsgenerering)
- Hanterar progress-tracking och felhantering
- Batch-processing av noder för effektiv LLM-användning

**Layout-motor (`layoutEngine.ts`):**
- Implementerar hierarkisk trädlayout med rekursiv algoritm
- Beräknar subtree-width för korrekt centrering av föräldrar
- Hanterar spacing och positionering för läsbarhet
- Centrerar hela trädet i viewport

---

## Metod

### Utvecklingsprocess

Projektet följer en fasbaserad utvecklingsmetodik med sex huvudfaser:

1. **Fas 1 - Dokumentinput och segmentering:** ✅ **KOMPLETT** - Implementering av PDF-extraktion och grundläggande segmenteringslogik. Stöd för PDF, Markdown och textfiler.
2. **Fas 2 - LLM-integration:** ✅ **KOMPLETT** - Konfiguration av Ollama-klient, verifiering av modelltillgänglighet, och IPC-integration för kommunikation mellan renderer och main process.
3. **Fas 3 - Hierarkiidentifiering:** ✅ **KOMPLETT** - Design av prompts, implementering av trädkonstruktion, validering av hierarkistruktur, och progress-feedback i UI.
4. **Fas 4 - Nodgenerering:** ✅ **KOMPLETT** - Generering av titlar och bullet points för varje nod med batch-processing och progress-tracking.
5. **Fas 5 - Layout-motor:** ✅ **KOMPLETT** - Automatisk positionering av noder baserat på hierarki med hierarkisk trädlayout, centrering i viewport, och kamera-positionering.
6. **Fas 6 - Integration och polish:** ⏳ **PÅGÅENDE** - UI-integration, felhantering och optimering (delvis implementerad)

### Teknisk implementation

**Dokumentflöde:**
```
PDF/text → Extraktion → Segmentering → LLM-analys → Hierarki → Nodgenerering → Layout → Canvas
```

**LLM-användning:**
- Hierarkiidentifiering: En prompt som ber modellen analysera dokumentet och returnera JSON-trädstruktur. Prompten inkluderar alla segmenterade delar med nivåinformation.
- Titelgenerering: Kort prompt för att sammanfatta innehåll i 3-7 ord. Använder befintlig titel om den är tillräckligt bra, annars genereras ny.
- Bullet-extraktion: Prompt för att extrahera 3-5 nyckelbullet points. Parserar olika listformat och begränsar till max 7 bullets per nod.

**Layout-algoritm:**
- Hierarkisk trädlayout med top-down-approach
- Root-nod placerad överst i mitten
- Barn-noder distribuerade horisontellt under föräldern med konfigurerbart spacing (80px standard)
- Rekursiv layout för subtrees med beräkning av subtree-width
- Föräldrar centreras automatiskt ovanför sina barn
- Vertikal spacing mellan nivåer (120px standard, 200px minimum per nivå)
- Automatisk centrering av hela trädet i viewport

### PDF-bibliotek: Utvecklingsprocess och tekniska utmaningar

Under implementeringen av PDF-extraktion testades flera bibliotek innan en lösning hittades som fungerade i Electron-miljön:

**1. pdf-parse (första försöket):**
- Problem: Biblioteket är en ES-modul som inte kunde importeras korrekt i Electron's main process med `require()`
- Fel: "Class constructor gr cannot be invoked without 'new'"
- Orsak: Inkompatibilitet mellan ES-moduler och Electron's CommonJS-kontext

**2. pdfjs-dist (Mozilla PDF.js):**
- Problem: Biblioteket försöker använda DOM-API:er som `DOMMatrix` som inte finns tillgängliga i Node.js/Electron main process
- Fel: "DOMMatrix is not defined"
- Orsak: Biblioteket är designat för webbläsarmiljöer med DOM-stöd, inte för Node.js

**3. pdf2json (slutlig lösning):**
- Framgång: Biblioteket är designat specifikt för Node.js och kräver inga DOM-API:er
- Fördelar: 
  - Fungerar direkt i Electron main process utan polyfills
  - Tillhandahåller både textinnehåll och metadata (font-storlekar, positioner)
  - Event-baserad API som passar väl för asynkron bearbetning
- Begränsningar: Extraherar endast textinnehåll, inte bilder eller komplex layout

**Lärdomar:**
- Electron main process kräver Node.js-kompatibla bibliotek utan DOM-beroenden
- ES-moduler behöver dynamisk `import()` istället för `require()` i vissa fall
- Bibliotek designade för webbläsare fungerar inte automatiskt i Node.js-miljöer
- Valet av `pdf2json` möjliggör framtida förbättringar med font- och positionsdata för bättre segmentering

### Testning och validering

- Testning med olika dokumenttyper (akademiska artiklar, blogginlägg, teknisk dokumentation)
- Validering av hierarkiidentifieringens noggrannhet genom LLM-analys
- Bedömning av genererade titlars och bullet points relevans
- Utvärdering av layoutens läsbarhet och användbarhet
- Verifiering av PDF-extraktion med olika PDF-format
- Testning av Ollama-integration och modelltillgänglighet
- Validering av edge cases i layout (ensam barn, många barn, djupa träd)

---

## Resultat och Diskussion

### Implementerade resultat

**Funktionalitet (Fas 1-5 komplett):**
- ✅ Systemet kan importera PDF-dokument och extrahera text med bevarad struktur (font-storlekar, fetstil, positioner)
- ✅ Stöd för Markdown och textfiler med automatisk segmentering
- ✅ LLM identifierar hierarkisk struktur i dokument och bygger trädstruktur
- ✅ Varje nod får en koncis titel (3-7 ord) och relevanta bullet points (3-5 st)
- ✅ Batch-processing av noder (3 i taget) med progress-tracking
- ✅ Noder positioneras automatiskt i läsbar hierarkisk layout med konfigurerbart spacing
- ✅ Kopplingar (edges) skapas automatiskt mellan förälder- och barn-noder
- ✅ Trädet centreras automatiskt i viewport med korrekt kamera-positionering
- ✅ Progress-modal visar real-time status under genereringsprocessen

**Användbarhet:**
- Användare kan snabbt skapa visuella mindmaps från långa dokument med ett enkelt import-kommando (Ctrl+I)
- Den ursprungliga dokumentstrukturen bevaras i den visuella representationen
- Genererade mindmaps kan redigeras, sparas och exporteras som vanliga projekt
- Automatisk layout eliminerar behovet av manuell positionering
- Hierarkisk struktur gör det lätt att navigera och förstå dokumentets organisation

### Diskussion

**Fördelar med lokal LLM:**
- Integritet: All bearbetning sker lokalt, inga data skickas till externa servrar
- Kostnad: Ingen API-kostnad, men kräver lokal beräkningsresurs
- Prestanda: `gemma3:1b` är snabb men kan ha begränsningar i kvalitet jämfört med större modeller

**Utmaningar och lösningar:**
- **PDF-bibliotek:** Flera bibliotek testades (`pdf-parse`, `pdfjs-dist`) innan `pdf2json` valdes för Node.js-kompatibilitet i Electron-miljön. Lösningen krävde specifik hantering av CommonJS vs ES-moduler.
- **Segmentering:** Initialt för känslig segmentering som fångade ord-för-ord. Lösning: Förbättrade heuristiker baserade på font-storlek, fetstil och position för att gruppera text i meningsfulla segment.
- **Layout-algoritm:** Rekursiv layout med korrekt centrering krävde beräkning av subtree-width för varje nod. Implementerad med rekursiv algoritm som först layoutar barn, sedan centrerar föräldrar.
- **LLM-responser:** Modellen kan returnera olika JSON-format. Lösning: Robust parsing som hanterar markdown code blocks, extra text, och olika format.
- **Progress-tracking:** Batch-processing kräver korrekt progress-beräkning. Implementerad med detaljerad progress-tracking per batch och total progress.
- **Mindre modeller:** `gemma3:1b` kan ha svårigheter med komplexa dokumentstrukturer, men fungerar bra för de flesta dokument med rätt prompt engineering.

**Framtida förbättringar (Fas 6 och post-MVP):**
- ✅ Delvis implementerad: Progress-modal och grundläggande felhantering
- ⏳ Ytterligare felhantering: Retry-logik, bättre felmeddelanden, fallback-strategier
- ⏳ Zoom-to-fit funktionalitet för att automatiskt zooma ut för att visa hela trädet
- ⏳ Stöd för större Ollama-modeller för bättre kvalitet
- ⏳ Förbättrad PDF-strukturdetektering med bättre användning av font- och positionsdata
- ⏳ Ytterligare layout-algoritmer (force-directed, radial) som användarval
- ⏳ Interaktiv förfining: regenerera individuella noder via högerklick-menyn
- ⏳ Batch-optimering: Cache av LLM-responser för identiskt innehåll
- ⏳ Stöd för Word-dokument (.docx)

---

## Slutsatser

Projektet demonstrerar hur AI kan användas för att bevara dokumentstruktur samtidigt som det skapar ökad användbarhet genom visuell mindmap-generering. Genom att kombinera dokumentanalys, LLM-baserad hierarkiidentifiering och automatisk layout kan systemet transformera linjära dokument till interaktiva visuella representationer.

**Huvudsakliga bidrag:**
1. ✅ Integration av lokal LLM (Ollama) för integritetsbevarande dokumentanalys med fullständig IPC-integration
2. ✅ Komplett pipeline från PDF-extraktion till visuell mindmap med bevarad hierarki (Fas 1-5 implementerad)
3. ✅ Automatisk layout-algoritm som positionerar noder baserat på dokumentstruktur med rekursiv subtree-beräkning
4. ✅ Batch-processing system för effektiv LLM-användning med progress-tracking
5. ✅ Robust felhantering och validering av hierarkistrukturer
6. ✅ Teknisk lösning för PDF-extraktion i Electron-miljö med `pdf2json`

**Praktisk relevans:**
Lösningen möjliggör för användare att snabbt skapa visuella översikter av komplexa dokument, vilket ökar förståelsen och användbarheten. Den lokala implementationen säkerställer att känsliga dokument kan bearbetas utan att lämna användarens dator. Systemet är funktionellt komplett för MVP-scenarier och kan användas för att generera mindmaps från PDF, Markdown och textfiler.

**Tekniska prestationer:**
- Implementerad pipeline från dokumentimport till visuell mindmap i 5 faser
- Robust hantering av olika dokumentformat och strukturer
- Effektiv batch-processing för att minimera LLM-anrop
- Automatisk layout som eliminerar manuellt arbete
- Progress-tracking och användarvänlig feedback

**Framtida arbete:**
Fortsatt utveckling kan fokusera på förbättrad prompt engineering för bättre resultat med mindre modeller, stöd för fler dokumentformat (Word, HTML), avancerade layout-algoritmer som tar hänsyn till semantisk likhet utöver hierarkisk struktur, och interaktiva förbättringar som möjlighet att regenerera individuella noder eller justera layout-parametrar.

