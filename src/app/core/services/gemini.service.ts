import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private systemPrompt = `
Du bist der persönliche AI-Assistent auf dem Portfolio von Hassan Ammar (AI Frontend Developer & Prompt Engineer aus Saarbrücken, Deutschland).
Deine Aufgabe ist es, Fragen von Besuchern präzise, professionell und ohne Emojis zu beantworten. Antworte immer in der Sprache des Nutzers (Deutsch oder Englisch).
Gib kurze, informative Antworten und verwende Markdown zur Strukturierung.

Fakten über Hassan Ammar:
- Rolle: AI Frontend Developer & Prompt Engineer.
- Ausbildung: Intensiv-Absolvent der Developer Akademie.
- Standort: Saarbrücken, Saarland, Deutschland.
- Tech-Stack: Angular 17+ (Signals, Standalone), TypeScript, JavaScript, SCSS, CSS, HTML, Firebase (Hosting, Firestore, Auth), Git, REST APIs, Material UI, Bootstrap, Scrum.
- Creative-Dev: GSAP, Three.js, Lenis Smooth Scroll.
- Projekte:
  1. Join (Kanban-Board für Team-Management): https://join.hassan-ammar.com | GitHub: https://github.com/a94hassan/join
  2. El Pollo Loco (2D Jump-and-Run-Spiel): https://el-pollo-loco.hassan-ammar.com | GitHub: https://github.com/a94hassan/el_pollo_loco
  3. Pokedex (Pokémon-Datenbank mit REST API): https://pokedex.hassan-ammar.com | GitHub: https://github.com/a94hassan/pokedex
- Kontakt: E-Mail an contact@hassan-ammar.com oder über das Kontaktformular auf der Seite.
`;

  constructor() {}

  /**
   * Checks if a custom Gemini API key is configured in localStorage.
   */
  hasApiKey(): boolean {
    const key = localStorage.getItem('GEMINI_API_KEY');
    return !!key && key.trim().length > 0;
  }

  /**
   * Set API Key in local storage for testing/custom integrations.
   */
  setApiKey(key: string): void {
    if (key.trim()) {
      localStorage.setItem('GEMINI_API_KEY', key.trim());
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
  }

  /**
   * Generates a response from Gemini or falls back to the local semantic engine.
   */
  async generateResponse(userMessage: string): Promise<string> {
    if (this.hasApiKey()) {
      try {
        const apiKey = localStorage.getItem('GEMINI_API_KEY')!;
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const ai = new GoogleGenerativeAI(apiKey);
        
        // Use gemini-2.5-flash as the standard fast web assistant model
        const model = ai.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: this.systemPrompt
        });

        const result = await model.generateContent(userMessage);
        return result.response.text() || 'Entschuldigung, ich konnte keine Antwort generieren.';
      } catch (err) {
        console.error('Gemini API Error, falling back to mock engine:', err);
        return this.generateMockResponse(userMessage) + '\n\n*(Hinweis: Der Aufruf der echten Gemini API schlug fehl, dies ist eine lokale Antwort.)*';
      }
    } else {
      // Return semantic mock response with simulated delay
      await new Promise(r => setTimeout(r, 1200));
      return this.generateMockResponse(userMessage);
    }
  }

  /**
   * Semantic mock engine for out-of-the-box operation on the portfolio website.
   */
  private generateMockResponse(msg: string): string {
    const lower = msg.toLowerCase();
    
    // Language detection
    const isEn = lower.includes('hello') || lower.includes('project') || lower.includes('skill') || lower.includes('contact') || lower.includes('work') || lower.includes('who');

    if (lower.includes('projekt') || lower.includes('project') || lower.includes('join') || lower.includes('pollo') || lower.includes('pokedex')) {
      if (isEn) {
        return `Hassan has developed several creative frontend projects:

1. **Join** (Kanban Board App): Team collaboration tool with drag-and-drop.
   - [Live Demo](https://join.hassan-ammar.com) | [GitHub](https://github.com/a94hassan/join)
2. **El Pollo Loco** (2D Action Game): Object-oriented canvas game with custom animations.
   - [Live Demo](https://el-pollo-loco.hassan-ammar.com) | [GitHub](https://github.com/a94hassan/el_pollo_loco)
3. **Pokedex** (Pokémon database): Interactive API search tool.
   - [Live Demo](https://pokedex.hassan-ammar.com) | [GitHub](https://github.com/a94hassan/pokedex)`;
      } else {
        return `Hassan hat verschiedene kreative Frontend-Projekte umgesetzt:

1. **Join** (Kanban-Board): Ein Tool zur Teamorganisation mit Drag-and-Drop-Interface.
   - [Live-Demo](https://join.hassan-ammar.com) | [GitHub-Repository](https://github.com/a94hassan/join)
2. **El Pollo Loco** (2D-Spiel): Ein klassisches Jump-and-Run-Spiel auf Canvas-Basis mit OOP-Struktur.
   - [Live-Demo](https://el-pollo-loco.hassan-ammar.com) | [GitHub-Repository](https://github.com/a94hassan/el_pollo_loco)
3. **Pokedex** (Datenbank): Ein Suchwerkzeug für Pokémon-Daten unter Einbindung einer REST API.
   - [Live-Demo](https://pokedex.hassan-ammar.com) | [GitHub-Repository](https://github.com/a94hassan/pokedex)`;
      }
    }

    if (lower.includes('skill') || lower.includes('tech') || lower.includes('sprache') || lower.includes('kenntnisse') || lower.includes('framework') || lower.includes('angular') || lower.includes('three')) {
      if (isEn) {
        return `Hassan's technology stack comprises:

- **Frontend Core:** Angular 17+ (Signals & Standalone Architecture), TypeScript, JavaScript, HTML5, CSS3, SCSS
- **Creative Stack:** GSAP, Three.js (WebGL), Lenis Smooth Scroll
- **Backend & Tooling:** Firebase (Firestore, Hosting, Auth), REST APIs, Git, Scrum-Methodologies`;
      } else {
        return `Hassans technologisches Profil umfasst:

- **Frontend-Kern:** Angular 17+ (Signals & Standalone-Architektur), TypeScript, JavaScript, HTML5, CSS3, SCSS
- **Kreative Animationen:** GSAP, Three.js (WebGL), Lenis Smooth Scroll
- **Infrastruktur & Tools:** Firebase (Firestore, Hosting, Auth), REST-Schnittstellen, Git, Scrum-Arbeitsweisen`;
      }
    }

    if (lower.includes('kontakt') || lower.includes('contact') || lower.includes('mail') || lower.includes('email') || lower.includes('nachricht') || lower.includes('schreiben')) {
      if (isEn) {
        return `You can reach Hassan Ammar directly:

- **E-Mail:** [contact@hassan-ammar.com](mailto:contact@hassan-ammar.com)
- **Contact Form:** Use the contact form at the bottom of this page.
- **Socials:** [GitHub](https://github.com/a94hassan) | [LinkedIn](https://www.linkedin.com/in/hassan-ammar-/)`;
      } else {
        return `Du kannst Hassan Ammar auf folgenden Wegen kontaktieren:

- **E-Mail:** [contact@hassan-ammar.com](mailto:contact@hassan-ammar.com)
- **Kontaktformular:** Nutze das Formular am Ende dieser Webseite.
- **Netzwerke:** [GitHub](https://github.com/a94hassan) | [LinkedIn](https://www.linkedin.com/in/hassan-ammar-/)`;
      }
    }

    if (lower.includes('wer') || lower.includes('hassan') || lower.includes('who') || lower.includes('profile') || lower.includes('lebenslauf') || lower.includes('cv')) {
      if (isEn) {
        return `Hassan Ammar is an **AI Frontend Developer & Prompt Engineer** based in Saarbrücken, Germany. 

He completed his intensive software engineering training at the **Developer Akademie** and specializes in building immersive, high-performance web experiences using Angular, GSAP, and Three.js.`;
      } else {
        return `Hassan Ammar ist ein **AI Frontend Developer & Prompt Engineer** aus Saarbrücken.

Er hat seine intensive Software-Entwickler-Ausbildung an der **Developer Akademie** absolviert und hat sich darauf spezialisiert, immersive und performante Web-Erlebnisse mit Angular, GSAP und Three.js zu entwerfen.`;
      }
    }

    // Default reply
    if (isEn) {
      return `Hello! I am Hassan's AI portfolio assistant. How can I help you today?

Feel free to ask about:
- Hassans **projects** (Join, El Pollo Loco, Pokedex)
- His **tech stack** and skills (Angular, GSAP, Three.js)
- How to **contact** him`;
    } else {
      return `Hallo! Ich bin Hassans persönlicher AI-Portfolio-Assistent. Wie kann ich dir heute helfen?

Frage mich gerne nach:
- Hassans **Projekten** (Join, El Pollo Loco, Pokedex)
- Seinem **Tech-Stack** und Kenntnissen (Angular, GSAP, Three.js)
- Möglichkeiten zur **Kontaktaufnahme**`;
    }
  }
}
