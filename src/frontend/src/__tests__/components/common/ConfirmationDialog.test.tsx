import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog';

describe('ConfirmationDialog', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  it('should render with title and message', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('should render default button texts', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render custom button texts', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Test"
        message="Test"
        confirmText="Yes, Delete"
        cancelText="No, Keep"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when loading', () => {
    render(
      <ConfirmationDialog
        open={true}
        title="Test"
        message="Test"
        loading={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('Confirm')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <ConfirmationDialog
        open={false}
        title="Test"
        message="Test"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });
});
