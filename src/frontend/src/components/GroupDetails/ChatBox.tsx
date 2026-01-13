import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getImageUrl, getInitials } from "../../utils/imageUtils";
import { GroupMessage } from "../../../../shared/types";

interface ChatBoxProps {
  chat: GroupMessage[];
  message: string;
  setMessage: (msg: string) => void;
  onSend: () => void;
  isTyping: boolean;
}

const formatTime = (timeString: string) => {
  try {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timeString;
  }
};

const ChatBox: React.FC<ChatBoxProps> = ({ chat, message, setMessage, onSend, isTyping }) => {
  const { t } = useTranslation();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  
  // Only scroll to bottom when a new message is added
  const prevChatLength = useRef<number>(chat.length);
  useEffect(() => {
    if (chat.length > prevChatLength.current && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    prevChatLength.current = chat.length;
  }, [chat]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg border border-slate-700/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">{t('groupDetails.groupChat')}</h2>
            <p className="text-xs text-slate-400">{chat.length} {chat.length === 1 ? t('groupDetails.message') : t('groupDetails.messages')}</p>
          </div>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px] bg-slate-900/30">
        {chat.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">{t('groupDetails.noMessages')}</p>
            <p className="text-slate-500 text-xs mt-1">{t('groupDetails.startConversation')}</p>
          </div>
        ) : (
          chat.map((msg, idx) => {
            const senderName = msg.user?.name || msg.sender || 'Unknown';
            const messageTime = msg.createdAt || msg.time || '';
            const messageContent = msg.content || msg.text || '';
            const profilePictureUrl = getImageUrl(msg.user?.profilePicture);
            
            return (
              <div key={idx} className="flex items-start gap-3 animate-fadein">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg flex-shrink-0 ring-2 ring-slate-700 overflow-hidden">
                  {profilePictureUrl ? (
                    <img src={profilePictureUrl} alt={senderName} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(senderName)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-200">{senderName}</span>
                    <span className="text-xs text-slate-500">{formatTime(String(messageTime))}</span>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg rounded-tl-none px-3 py-2 text-sm text-gray-300 shadow-sm border border-slate-700/30">
                    {messageContent}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>
      
      {/* Typing Indicator */}
      {isTyping && (
        <div className="px-5 py-2 bg-slate-800/30 border-t border-slate-700/30">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span>{t('groupDetails.someoneIsTyping')}</span>
          </div>
        </div>
      )}
      
      {/* Input Area */}
      <div className="px-4 py-4 bg-slate-800/50 border-t border-slate-700/50 backdrop-blur-sm">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-gray-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition text-sm"
              placeholder={t('groupDetails.typeMessage')}
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              aria-label={t('groupDetails.typeMessage')}
            />
          </div>
          <button 
            onClick={onSend}
            disabled={!message.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {t('groupDetails.send')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ChatBox;
