import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge, StatusType } from '../../../components/common/StatusBadge';

describe('StatusBadge', () => {
  it('should render with label', () => {
    render(<StatusBadge status="success" label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should apply success color classes', () => {
    const { container } = render(<StatusBadge status="success" label="Success" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-green-900/50', 'text-green-300', 'border-green-700');
  });

  it('should apply error color classes', () => {
    const { container } = render(<StatusBadge status="error" label="Error" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-red-900/50', 'text-red-300', 'border-red-700');
  });

  it('should apply warning color classes', () => {
    const { container } = render(<StatusBadge status="warning" label="Warning" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-yellow-900/50', 'text-yellow-300', 'border-yellow-700');
  });

  it('should apply info color classes', () => {
    const { container } = render(<StatusBadge status="info" label="Info" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-blue-900/50', 'text-blue-300', 'border-blue-700');
  });

  it('should apply default color classes', () => {
    const { container } = render(<StatusBadge status="default" label="Default" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-gray-700', 'text-gray-300', 'border-gray-600');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <StatusBadge status="success" label="Custom" className="custom-class" />
    );
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('custom-class');
  });

  it('should always have base classes', () => {
    const { container } = render(<StatusBadge status="success" label="Test" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'px-2.5',
      'py-0.5',
      'rounded-full',
      'text-xs',
      'font-semibold',
      'border'
    );
  });

  it('should render all status types correctly', () => {
    const statuses: StatusType[] = ['success', 'error', 'warning', 'info', 'default'];
    
    statuses.forEach(status => {
      const { container, unmount } = render(
        <StatusBadge status={status} label={status} />
      );
      expect(screen.getByText(status)).toBeInTheDocument();
      const badge = container.querySelector('span');
      expect(badge).toBeTruthy();
      unmount();
    });
  });
});
