import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
// Removed all MUI imports; using Tailwind and SVGs
import { 
  GridIcon, 
  ChevronDownIcon,
  ChevronUpIcon
} from '../icons';

export interface QuickLink {
  label: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

interface QuickLinksProps {
  links: QuickLink[];
  onNavigate: (path: string) => void;
}

const QuickLinks: React.FC<QuickLinksProps> = ({ links, onNavigate }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[#1a2233] rounded-xl shadow-md p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-500 rounded-full w-9 h-9 flex items-center justify-center">
          {/* Grid icon for Quick Links */}
          <GridIcon className="w-6 h-6 text-white" />
        </div>
        <div className="text-lg font-semibold flex-1">{t('dashboard.quickLinks', 'Quick Links')}</div>
        <button className="focus:outline-none" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
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
