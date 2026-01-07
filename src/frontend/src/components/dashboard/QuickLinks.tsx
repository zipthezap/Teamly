import React, { useState } from 'react';
// Removed all MUI imports; using Tailwind and SVGs
import { 
  GridIcon, 
  UsersIcon, 
  CalendarIcon, 
  GlobeIcon, 
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '../icons';

interface QuickLinksProps {
  onNavigate: (path: string) => void;
}

const QuickLinks: React.FC<QuickLinksProps> = ({ onNavigate }) => {
  const links = [
    {
      label: 'My Groups',
      icon: <UsersIcon className="w-5 h-5 text-white" />,
      path: '/groups',
      color: 'bg-blue-500',
    },
    {
      label: 'All Events',
      icon: <CalendarIcon className="w-5 h-5 text-white" />,
      path: '/events',
      color: 'bg-pink-500',
    },
    {
      label: 'Discover Groups',
      icon: <GlobeIcon className="w-5 h-5 text-white" />,
      path: '/public-groups',
      color: 'bg-green-500',
    },
    {
      label: 'My Profile',
      icon: <UserIcon className="w-5 h-5 text-white" />,
      path: '/profile',
      color: 'bg-yellow-500',
    },
  ];

  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[#1a2233] rounded-xl shadow-md p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-500 rounded-full w-9 h-9 flex items-center justify-center">
          {/* Grid icon for Quick Links */}
          <GridIcon className="w-6 h-6 text-white" />
        </div>
        <div className="text-lg font-semibold flex-1">Quick Links</div>
        <button className="focus:outline-none" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
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
