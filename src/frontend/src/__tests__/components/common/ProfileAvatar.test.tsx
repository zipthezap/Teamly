import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ProfileAvatar } from '../../../components/common/ProfileAvatar';

// Mock imageUtils to avoid import.meta issues
vi.mock('../../../utils/imageUtils', () => ({
  getImageUrl: vi.fn((picture?: string | { url: string } | null) => {
    if (!picture) return undefined;
    if (typeof picture === 'string') return picture;
    if (typeof picture === 'object' && 'url' in picture) return picture.url;
    return undefined;
  }),
  getInitials: vi.fn((name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }),
}));

describe('ProfileAvatar', () => {
  it('should render initials when no picture is provided', () => {
    const { container } = render(<ProfileAvatar name="John Doe" picture={null} />);
    expect(container.querySelector('.MuiAvatar-root')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should render single initial for single name', () => {
    const { container } = render(<ProfileAvatar name="John" picture={null} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('should render image when picture URL is provided', () => {
    const { container } = render(
      <ProfileAvatar name="John Doe" picture="http://example.com/pic.jpg" />
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://example.com/pic.jpg');
  });

  it('should render image when picture object is provided', () => {
    const { container } = render(
      <ProfileAvatar name="John Doe" picture={{ url: '/uploads/pic.jpg' }} />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('should use custom size', () => {
    const { container } = render(<ProfileAvatar name="John Doe" picture={null} size={60} />);
    const avatar = container.querySelector('.MuiAvatar-root');
    expect(avatar).toHaveStyle({ width: '60px', height: '60px' });
  });

  it('should use circular variant by default', () => {
    const { container } = render(<ProfileAvatar name="John Doe" picture={null} />);
    const avatar = container.querySelector('.MuiAvatar-root');
    expect(avatar).toHaveClass('MuiAvatar-circular');
  });

  it('should use rounded variant when specified', () => {
    const { container } = render(<ProfileAvatar name="John Doe" picture={null} variant="rounded" />);
    const avatar = container.querySelector('.MuiAvatar-root');
    expect(avatar).toHaveClass('MuiAvatar-rounded');
  });

  it('should render question mark for empty name', () => {
    const { container } = render(<ProfileAvatar name="" picture={null} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
