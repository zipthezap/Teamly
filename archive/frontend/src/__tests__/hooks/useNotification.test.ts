import { renderHook, act } from '@testing-library/react';
import { useNotification } from '../../hooks/useNotification';

describe('useNotification', () => {
  it('should initialize with closed notification', () => {
    const { result } = renderHook(() => useNotification());
    expect(result.current.notification.open).toBe(false);
  });

  it('should show success notification', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showSuccess('Success message');
    });
    
    expect(result.current.notification.message).toBe('Success message');
    expect(result.current.notification.severity).toBe('success');
    expect(result.current.notification.open).toBe(true);
  });

  it('should show error notification', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showError('Error message');
    });
    
    expect(result.current.notification.message).toBe('Error message');
    expect(result.current.notification.severity).toBe('error');
    expect(result.current.notification.open).toBe(true);
  });

  it('should show info notification', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showInfo('Info message');
    });
    
    expect(result.current.notification.message).toBe('Info message');
    expect(result.current.notification.severity).toBe('info');
    expect(result.current.notification.open).toBe(true);
  });

  it('should show warning notification', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showWarning('Warning message');
    });
    
    expect(result.current.notification.message).toBe('Warning message');
    expect(result.current.notification.severity).toBe('warning');
    expect(result.current.notification.open).toBe(true);
  });

  it('should hide notification', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showSuccess('Success');
    });
    
    expect(result.current.notification.open).toBe(true);
    
    act(() => {
      result.current.hideNotification();
    });
    
    expect(result.current.notification.open).toBe(false);
  });

  it('should show notification with custom severity', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showNotification('Custom message', 'warning');
    });
    
    expect(result.current.notification.message).toBe('Custom message');
    expect(result.current.notification.severity).toBe('warning');
    expect(result.current.notification.open).toBe(true);
  });
});
