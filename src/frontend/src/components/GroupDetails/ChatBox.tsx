import React, { useRef, useEffect } from "react";
import { ChatMessage } from "../../types/group";
import Button from "../ui/Button";
import Input from "../ui/Input";

interface ChatBoxProps {
  chat: ChatMessage[];
  message: string;
  setMessage: (msg: string) => void;
  onSend: () => void;
  isTyping: boolean;
}

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

const ChatBox: React.FC<ChatBoxProps> = ({ chat, message, setMessage, onSend, isTyping }) => {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat]);

  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow flex flex-col max-h-[400px]">
      <h2 className="text-xl font-semibold mb-2">Group Chat</h2>
      <div className="flex-1 overflow-y-auto mb-2 bg-slate-700 rounded p-2 min-h-[100px] max-h-[220px]">
        {chat.length === 0 ? (
          <div className="text-slate-400">No messages yet.</div>
        ) : (
          chat.map((msg, idx) => (
            <div key={idx} className="mb-2 flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold mt-0.5">
                {getInitials(msg.sender)}
              </div>
              <div>
                <span className="font-bold text-sm">{msg.sender}</span>
                <span className="ml-2 text-xs text-slate-400">{msg.time}</span>
                <div className="text-sm">{msg.text}</div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      {isTyping && (
        <div className="text-xs text-slate-400 mb-1">Someone is typing...</div>
      )}
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Type a message..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSend()}
          aria-label="Type a message"
        />
        <Button color="primary" onClick={onSend}>Send</Button>
      </div>
    </section>
  );
};

export default ChatBox;
