import React, { useState } from 'react';
// Removed all MUI imports; using Tailwind and SVGs

interface QuickLinksProps {
  onNavigate: (path: string) => void;
}

const QuickLinks: React.FC<QuickLinksProps> = ({ onNavigate }) => {
  const links = [
    {
      label: 'My Groups',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /></svg>
      ),
      path: '/groups',
      color: 'bg-blue-500',
    },
    {
      label: 'All Events',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      ),
      path: '/events',
      color: 'bg-pink-500',
    },
    {
      label: 'Discover Groups',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M2 12h2m16 0h2M12 2v2m0 16v2m7.07-7.07l-1.42-1.42M4.93 19.07l-1.42-1.42M19.07 4.93l-1.42 1.42M4.93 4.93l1.42 1.42" /></svg>
      ),
      path: '/public-groups',
      color: 'bg-green-500',
    },
    {
      label: 'My Profile',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a8.38 8.38 0 0 1 13 0" /></svg>
      ),
      path: '/profile',
      color: 'bg-yellow-500',
    },
  ];

  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[#1a2233] rounded-xl shadow-md p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-500 rounded-full w-9 h-9 flex items-center justify-center">
          {/* Star icon for Quick Links */}
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>
        </div>
        <div className="text-lg font-semibold flex-1">Quick Links</div>
        <button className="focus:outline-none" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[600px]' : 'max-h-0'}`}
        style={{ willChange: 'max-height' }}
        aria-hidden={!open}
      >
        <ul>
          {links.map((link, index) => (
            <li key={index} className="mb-1">
              <button
                onClick={() => onNavigate(link.path)}
                className="flex items-center w-full rounded-lg py-2 px-3 transition hover:bg-[#232946] focus:outline-none"
              >
                <span className={`flex items-center justify-center rounded-full w-7 h-7 mr-3 ${link.color}`}>{link.icon}</span>
                <span className="font-medium text-sm">{link.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default QuickLinks;
