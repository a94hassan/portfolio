import { Component, inject, signal, effect, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../../core/services/gemini.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  time: Date;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.scss'
})
export class AiChatComponent implements OnDestroy {
  private geminiService = inject(GeminiService);
  private translateService = inject(TranslateService);
  private langSubscription?: Subscription;
  
  @ViewChild('chatHistory') private chatHistoryContainer!: ElementRef;

  isOpen = signal<boolean>(false);
  isTyping = signal<boolean>(false);
  showSettings = signal<boolean>(false);
  
  userInput = '';
  customApiKey = '';

  messages = signal<ChatMessage[]>([
    {
      sender: 'bot',
      text: 'Hallo! Ich bin Hassans AI-Portfolio-Assistent. Wie kann ich dir heute helfen?\n\nFrag mich gerne zu seinen Projekten (Join, El Pollo Loco, Pokedex), seinen Fähigkeiten oder wie du ihn kontaktieren kannst.',
      time: new Date()
    }
  ]);

  suggestedPrompts: { label: string; text: string }[] = [];

  constructor() {
    // Load custom API key from service state on load
    this.customApiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    
    // Auto-scroll effect whenever messages list changes
    effect(() => {
      if (this.messages().length > 0) {
        this.scrollToBottom();
      }
    });

    this.updateTranslations();
    this.langSubscription = this.translateService.onLangChange.subscribe(() => {
      this.updateTranslations();
    });
  }

  ngOnDestroy(): void {
    this.langSubscription?.unsubscribe();
  }

  private updateTranslations(): void {
    const keys = [
      'chat_welcome',
      'chat_prompt_label1',
      'chat_prompt_text1',
      'chat_prompt_label2',
      'chat_prompt_text2',
      'chat_prompt_label3',
      'chat_prompt_text3'
    ];
    this.translateService.get(keys).subscribe(res => {
      const welcomeText = res['chat_welcome'] || 'Hallo! Ich bin Hassans AI-Portfolio-Assistent. Wie kann ich dir heute helfen?\n\nFrag mich gerne zu seinen Projekten (Join, El Pollo Loco, Pokedex), seinen Fähigkeiten oder wie du ihn kontaktieren kannst.';
      
      const currentMessages = this.messages();
      if (currentMessages.length === 1 && currentMessages[0].sender === 'bot') {
        this.messages.set([
          {
            sender: 'bot',
            text: welcomeText,
            time: currentMessages[0].time
          }
        ]);
      }

      this.suggestedPrompts = [
        {
          label: res['chat_prompt_label1'] || 'Projekte?',
          text: res['chat_prompt_text1'] || 'Welche Projekte hat Hassan entwickelt?'
        },
        {
          label: res['chat_prompt_label2'] || 'Skills?',
          text: res['chat_prompt_text2'] || 'Welchen Tech-Stack nutzt er?'
        },
        {
          label: res['chat_prompt_label3'] || 'Kontakt?',
          text: res['chat_prompt_text3'] || 'Wie kann ich Hassan kontaktieren?'
        }
      ];
    });
  }

  toggleChat(): void {
    this.isOpen.update(val => !val);
    if (this.isOpen()) {
      this.scrollToBottom();
    }
  }

  toggleSettings(): void {
    this.showSettings.update(val => !val);
  }

  saveApiKey(): void {
    this.geminiService.setApiKey(this.customApiKey);
    this.showSettings.set(false);
  }

  hasCustomKey(): boolean {
    return this.geminiService.hasApiKey();
  }

  async sendMessage(textToSend?: string): Promise<void> {
    const messageText = (textToSend || this.userInput).trim();
    if (!messageText) return;

    if (!textToSend) {
      this.userInput = '';
    }

    // Add user message
    this.messages.update(prev => [...prev, {
      sender: 'user',
      text: messageText,
      time: new Date()
    }]);

    this.isTyping.set(true);
    this.scrollToBottom();

    try {
      const response = await this.geminiService.generateResponse(messageText);
      this.messages.update(prev => [...prev, {
        sender: 'bot',
        text: response,
        time: new Date()
      }]);
    } catch (err) {
      this.messages.update(prev => [...prev, {
        sender: 'bot',
        text: this.translateService.instant('chat_error') || 'Something went wrong. Please try again.',
        time: new Date()
      }]);
    } finally {
      this.isTyping.set(false);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.chatHistoryContainer) {
          const el = this.chatHistoryContainer.nativeElement;
          el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth'
          });
        }
      } catch (err) {
        // Safe guard
      }
    }, 100);
  }

  formatMessage(text: string): string {
    // Escape HTML first to prevent XSS
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Convert newlines to <br>
    escaped = escaped.replace(/\n/g, '<br>');

    // Convert markdown links [link text](url) to HTML links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return escaped.replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');
  }
}
