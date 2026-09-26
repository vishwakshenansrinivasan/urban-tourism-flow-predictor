import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  X,
  Trash2,
  MapPin,
  ExternalLink
} from 'lucide-react';

const SUGGESTIONS = [
  { label: '🏖️ Best time for Marina Beach?', query: 'When is the best time to visit Marina Beach tomorrow to avoid rush?' },
  { label: '🚨 Worst traffic hotspots now?', query: 'Where is the highest congestion and worst bottleneck right now in Chennai?' },
  { label: '🛍️ T. Nagar shopping peak forecast?', query: 'When will T. Nagar Ranganathan Street peak in traffic and shopping crowd?' },
  { label: '🚇 Kathipara vs Metro for morning rush?', query: 'Should I take CMRL Metro or drive through Kathipara during morning rush?' },
  { label: '🧠 XGBoost model accuracy scores?', query: 'How accurate is the prediction model and what are its R2 and MAE scores?' },
  { label: '🌧️ Monsoon rain impact on roads?', query: 'How does heavy monsoon rain affect transit flow and road congestion?' }
];

export default function ChatAssistant({
  isOpen,
  onToggle,
  nodes = [],
  selectedNodeId = null,
  selectedHour = 1,
  onSelectNodeAndNavigateToMap = null
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `### 👋 Vanakkam! I am **PulseAI**, your Chennai Urban Flow & Tourism Copilot.\n\nI analyze live CMRL Metro telemetry, suburban rail frequencies, and **48-hour forward XGBoost predictions** across all 12 Chennai landmark hubs.\n\n**Ask me anything like:**\n- *"When is the best time to visit Marina Beach?"*\n- *"Where is traffic peak right now?"*\n- *"Will Kathipara be congested tomorrow at 9 AM?"*\n- *"What are the model accuracy metrics?"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Best time to visit Marina Beach?',
        'Where is the worst traffic right now?',
        'When will T. Nagar shopping peak?',
        'How accurate is the XGBoost model?'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (queryText = null) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isTyping) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          context: {
            selectedNodeId,
            selectedHour
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        const botMsg = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          matched_node: data.matched_node || null,
          metrics_summary: data.metrics_summary || null,
          suggestions: data.suggestions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            role: 'assistant',
            text: `⚠️ **Unable to fetch predictions**: ${data.error || 'Please try again.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **Network Error**: Could not connect to the PulseAI prediction backend.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        text: `Chat history cleared. How can I assist you with Chennai transit and tourism flow predictions?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'Best time to visit Marina Beach?',
          'Where is the worst traffic right now?',
          'When will T. Nagar shopping peak?'
        ]
      }
    ]);
  };

  // Simple Markdown-to-HTML parser for formatted bot output
  const renderFormattedText = (text) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-slate-900 mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h5 key={idx} className="text-xs font-semibold text-slate-800 mt-1.5 mb-1">
            {line.replace('#### ', '')}
          </h5>
        );
      }
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.includes('---')) return null;
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        return (
          <div key={idx} className="grid grid-cols-4 gap-1 text-[11px] py-1 border-b border-slate-200 font-mono">
            {cells.map((cell, cIdx) => (
              <span key={cIdx} className={cIdx === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                {cell.replace(/\*\*/g, '')}
              </span>
            ))}
          </div>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.substring(2);
        return (
          <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 my-0.5 pl-1">
            <span className="text-indigo-600 shrink-0 leading-5">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={idx} className="text-xs text-slate-700 my-1 pl-1" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-slate-700 leading-relaxed my-0.5" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    });
  };

  const formatInline = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-semibold">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.2 rounded bg-slate-100 text-indigo-700 font-mono text-[11px] border border-slate-200">$1</code>')
      .replace(/\*([^*]+)\*/g, '<em class="text-slate-500 italic">$1</em>');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 right-4 z-50 w-[92vw] sm:w-[440px] h-[calc(100vh-5rem)] max-h-[620px] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-slide-right">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">PulseAI</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-medium border border-indigo-100">
                Live Copilot
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>48h Projections · SHAP Attribution</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg btn-secondary text-slate-400 hover:text-rose-600 cursor-pointer"
            title="Clear Conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg btn-secondary text-slate-400 hover:text-slate-900 cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preset Quick Chips Bar */}
      <div className="px-3 py-2 border-b border-slate-100 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0 bg-slate-50">
        {SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s.query)}
            className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-[11px] text-slate-600 transition cursor-pointer shadow-xs"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/50">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-3.5 py-2.5 shadow-xs ${
                m.role === 'user'
                  ? 'btn-primary rounded-br-none text-xs leading-relaxed'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
              }`}
            >
              {m.role === 'user' ? (
                <p className="text-white font-medium">{m.text}</p>
              ) : (
                <div className="space-y-1">{renderFormattedText(m.text)}</div>
              )}

              {/* Matched Node Interactive Card */}
              {m.matched_node && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold truncate">{m.matched_node.name}</span>
                  </div>
                  {onSelectNodeAndNavigateToMap && (
                    <button
                      onClick={() => onSelectNodeAndNavigateToMap(m.matched_node.id)}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 hover:bg-indigo-100"
                    >
                      <span>Open Map</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Context Suggestions */}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {m.suggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSend(sug)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition cursor-pointer"
                    >
                      ↳ {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-[9px] font-mono text-slate-400 mt-1 px-1">
              {m.timestamp}
            </span>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 w-16 shadow-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 shrink-0 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Marina Beach, rush hours, Metro routing…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2 rounded-lg btn-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
