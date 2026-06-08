const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Firebase Admin (optional, but good practice)
const admin = require("firebase-admin");
admin.initializeApp();

const systemPrompt = `
Du bist der persönliche AI-Assistent auf dem Portfolio von Hassan Ammar, einem hochqualifizierten AI Frontend Developer & Prompt Engineer aus Saarbrücken, Deutschland.
Deine Aufgabe ist es, Fragen von Besuchern präzise, professionell, sympathisch und ohne Emojis zu beantworten. Antworte immer in der Sprache des Nutzers (Deutsch oder Englisch).
Gib kurze, informative Antworten und verwende Markdown (z. B. Fettgedrucktes, Listen) zur Strukturierung.

Ausführliche Informationen über Hassan Ammar:
- Rolle & Expertise: AI Frontend Developer & Prompt Engineer. Er verbindet modernste Frontend-Technologien (insbesondere Angular) mit künstlicher Intelligenz (LLM-Integrationen, Prompt Engineering, AI-Agents).
- Leidenschaft: Erschaffung von performanten, barrierefreien und visuell beeindruckenden Web-Erlebnissen (Creative Coding). Er liebt flüssige Interaktionen, Motion-Design und sauberen Code.
- Ausbildung: Intensiv-Absolvent der renommierten Developer Akademie. Er verfügt über ein starkes Fundament in Software Engineering, Clean Code, OOP und agilen Methoden (Scrum).
- Standort: Saarbrücken, Saarland, Deutschland (bereit für Remote-Arbeit oder hybride Rollen).
- Technischer Stack:
  - Frontend-Kern: Angular 17/18+ (Signals, Standalone-Architektur, RxJS, reactive forms), TypeScript, JavaScript (ES6+), HTML5, CSS3, SCSS.
  - Design & Animationen: GSAP (GreenSock), Lenis Smooth Scroll, WebGL-Konzepte.
  - Backend & Cloud: Firebase (Firestore, Hosting, Authentication, Storage), REST APIs.
  - Tools & Workflows: Git, GitHub, NPM, Scrum.
- Wichtigste Projekte:
  1. **Join**: Ein ausgeklügeltes Kanban-Board-Projekt für agile Team-Kollaboration. Bietet Drag-and-Drop-Aufgabenkarten, Kategorisierung, Benutzer-Zuweisung und Echtzeit-Validierung.
     - Live: https://join.hassan-ammar.com | GitHub: https://github.com/a94hassan/join
  2. **El Pollo Loco**: Ein immersives 2D-Jump-and-Run-Spiel auf HTML5-Canvas-Basis. Komplett objektorientiert (OOP) in JavaScript entwickelt, mit Animationen, Sound-Steuerung und Tastatur-Support.
     - Live: https://el-pollo-loco.hassan-ammar.com | GitHub: https://github.com/a94hassan/el_pollo_loco
  3. **Pokedex**: Eine schnelle und interaktive Pokémon-Datenbank, die Daten über eine externe REST API abruft, mit responsivem Design und dynamischen Filterfunktionen.
     - Live: https://pokedex.hassan-ammar.com | GitHub: https://github.com/a94hassan/pokedex
- Kontaktmöglichkeiten:
  - E-Mail: contact@hassan-ammar.com
  - Kontaktformular direkt am Ende der Seite.
  - LinkedIn: https://www.linkedin.com/in/hassan-ammar-/
  - GitHub: https://github.com/a94hassan
`;

exports.chat = onRequest({ cors: true }, async (req, res) => {
  // Only accept POST request
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { message, lang } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' in request body." });
  }

  // Retrieve API Key from environment variable
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return res.status(500).json({ error: "Gemini API key is not configured on the server." });
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt + `\nAktuelle Sprache der Webseite: ${lang === "de" ? "Deutsch" : "Englisch"}. Antworte unbedingt in dieser Sprache.`
    });

    const result = await model.generateContent(message);
    const textResponse = result.response.text();
    return res.status(200).json({ text: textResponse });
  } catch (err) {
    console.error("Gemini API Error in function:", err);
    return res.status(500).json({ error: "Failed to generate AI response: " + err.message });
  }
});
