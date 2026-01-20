import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventSearchFilters from '../../../components/event/EventSearchFilters';

describe('EventSearchFilters', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  it('should render search input', () => {
    render(<EventSearchFilters onSearch={mockOnSearch} />);
    const searchInput = screen.getByPlaceholderText(/search events/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should render filter and search buttons', () => {
    render(<EventSearchFilters onSearch={mockOnSearch} />);
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('should toggle filter panel when filter button is clicked', async () => {
    render(<EventSearchFilters onSearch={mockOnSearch} />);
    
    const filterButton = screen.getByRole('button', { name: /filters/i });
    
    // Initially, advanced filters should not be visible
    expect(screen.queryByLabelText(/event type/i)).not.toBeVisible();
    
    // Click to show filters
    fireEvent.click(filterButton);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/event type/i)).toBeVisible();
      expect(screen.getByLabelText(/location/i)).toBeVisible();
      expect(screen.getByLabelText(/start date/i)).toBeVisible();
      expect(screen.getByLabelText(/end date/i)).toBeVisible();
    });
  });

  it('should call onSearch with filters when search button is clicked', async () => {
    const user = userEvent.setup();
    render(<EventSearchFilters onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByPlaceholderText(/search events/i);
    await user.type(searchInput, 'Football');
    
    const searchButton = screen.getByRole('button', { name: /^search$/i });
    fireEvent.click(searchButton);
    
    expect(mockOnSearch).toHaveBeenCalledWith({ search: 'Football' });
  });

  it('should call onSearch when Enter key is pressed in search input', async () => {
    const user = userEvent.setup();
    render(<EventSearchFilters onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByPlaceholderText(/search events/i);
    await user.type(searchInput, 'Basketball{Enter}');
    
    expect(mockOnSearch).toHaveBeenCalledWith({ search: 'Basketball' });
  });

  it('should not include empty values in search', async () => {
    const user = userEvent.setup();
    render(<EventSearchFilters onSearch={mockOnSearch} />);
    
    // Open filter panel
    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/event type/i)).toBeVisible();
    });
    
    // Fill in only one filter
    const eventTypeInput = screen.getByLabelText(/event type/i);
    await user.type(eventTypeInput, 'Basketball');
    
    // Click search
    const searchButton = screen.getByRole('button', { name: /^search$/i });
    fireEvent.click(searchButton);
    
    // Should only include non-empty values
    expect(mockOnSearch).toHaveBeenCalledWith({
      eventType: 'Basketball',
    });
  });
});
