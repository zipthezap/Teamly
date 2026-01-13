/**
 * Generic Form State Hook
 * Provides reusable form state management to reduce duplication across components
 */

import { useState, useCallback } from 'react';

interface UseFormStateOptions<T> {
  initialValues: T;
  onSubmit?: (values: T) => Promise<void> | void;
  validate?: (values: T) => Record<string, string>;
}

interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
}

interface UseFormStateReturn<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  handleChange: (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement> | unknown) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  setFieldValue: (field: keyof T, value: T[keyof T]) => void;
  setFieldError: (field: keyof T, error: string) => void;
  setValues: (values: Partial<T>) => void;
  resetForm: () => void;
  isValid: boolean;
}

/**
 * Generic form state management hook
 * Handles form values, validation, errors, and submission
 */
export const useFormState = <T extends Record<string, unknown>>({
  initialValues,
  onSubmit,
  validate,
}: UseFormStateOptions<T>): UseFormStateReturn<T> => {
  const [formState, setFormState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
  });

  const handleChange = useCallback((field: keyof T) => (e: React.ChangeEvent<HTMLInputElement> | unknown) => {
    const value = (e as React.ChangeEvent<HTMLInputElement>).target 
      ? ((e as React.ChangeEvent<HTMLInputElement>).target.type === 'checkbox' 
        ? (e as React.ChangeEvent<HTMLInputElement>).target.checked 
        : (e as React.ChangeEvent<HTMLInputElement>).target.value) 
      : e;
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      errors: { ...prev.errors, [field]: '' },
    }));
  }, []);

  const handleBlur = useCallback((field: keyof T) => () => {
    setFormState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [field]: true },
    }));
  }, []);

  const setFieldValue = useCallback((field: keyof T, value: T[keyof T]) => {
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value },
    }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setFormState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: error },
    }));
  }, []);

  const setValues = useCallback((values: Partial<T>) => {
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, ...values },
    }));
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Run validation if provided
    if (validate) {
      const errors = validate(formState.values);
      if (Object.keys(errors).length > 0) {
        setFormState((prev) => ({ ...prev, errors }));
        return;
      }
    }

    if (!onSubmit) return;

    setFormState((prev) => ({ ...prev, isSubmitting: true, errors: {} }));
    try {
      await onSubmit(formState.values);
    } catch (error: any) {
      // Handle submission errors
      const errorMessage = error.response?.data?.error || error.message || 'Submission failed';
      setFormState((prev) => ({
        ...prev,
        errors: { submit: errorMessage },
      }));
    } finally {
      setFormState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [formState.values, onSubmit, validate]);

  const resetForm = useCallback(() => {
    setFormState({
      values: initialValues,
      errors: {},
      touched: {},
      isSubmitting: false,
    });
  }, [initialValues]);

  const isValid = Object.keys(formState.errors).length === 0;

  return {
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isSubmitting: formState.isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    setValues,
    resetForm,
    isValid,
  };
};
