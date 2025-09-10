import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../../components/ui/input';

describe('Input Component', () => {
  describe('Rendering', () => {
    test('should render input element', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');

      expect(input).toBeInTheDocument();
    });

    test('should render with default type text', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('type', 'text');
    });

    test('should render with custom type', () => {
      render(<Input type='email' />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('type', 'email');
    });

    test('should render password input', () => {
      render(<Input type='password' />);
      const input =
        screen.getByLabelText(/password/i) || document.querySelector('input[type="password"]');

      expect(input).toHaveAttribute('type', 'password');
    });

    test('should forward ref correctly', () => {
      const ref = React.createRef();
      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('Styling', () => {
    test('should have default classes', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass(
        'flex',
        'h-9',
        'w-full',
        'rounded-md',
        'border',
        'border-input',
        'bg-transparent',
        'px-3',
        'py-1'
      );
    });

    test('should merge custom className', () => {
      render(<Input className='custom-class' />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass('custom-class');
      expect(input).toHaveClass('flex'); // Still has default classes
    });

    test('should have focus styles', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-1',
        'focus-visible:ring-ring'
      );
    });

    test('should have disabled styles', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
      expect(input).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    test('should handle input changes', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'Hello World');

      expect(input).toHaveValue('Hello World');
    });

    test('should call onChange handler', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'a');

      expect(handleChange).toHaveBeenCalled();
    });

    test('should handle focus and blur events', async () => {
      const handleFocus = jest.fn();
      const handleBlur = jest.fn();
      const user = userEvent.setup();

      render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');

      await user.click(input);
      expect(handleFocus).toHaveBeenCalled();

      await user.tab();
      expect(handleBlur).toHaveBeenCalled();
    });

    test('should be disabled when disabled prop is true', () => {
      const handleChange = jest.fn();
      render(<Input disabled onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      expect(input).toBeDisabled();

      fireEvent.change(input, { target: { value: 'test' } });
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Props Forwarding', () => {
    test('should forward all input props', () => {
      render(
        <Input
          placeholder='Enter text'
          maxLength={10}
          readOnly
          data-testid='custom-input'
          aria-label='Custom input'
        />
      );

      const input = screen.getByTestId('custom-input');
      expect(input).toHaveAttribute('placeholder', 'Enter text');
      expect(input).toHaveAttribute('maxLength', '10');
      expect(input).toHaveAttribute('readOnly');
      expect(input).toHaveAttribute('aria-label', 'Custom input');
    });

    test('should handle value prop', () => {
      render(<Input value='controlled value' onChange={() => {}} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveValue('controlled value');
    });

    test('should handle defaultValue prop', () => {
      render(<Input defaultValue='default value' />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveValue('default value');
    });
  });

  describe('Input Types', () => {
    test('should render number input', () => {
      render(<Input type='number' />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('type', 'number');
    });

    test('should render email input', () => {
      render(<Input type='email' />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('type', 'email');
    });

    test('should render search input', () => {
      render(<Input type='search' />);
      const input = screen.getByRole('searchbox');

      expect(input).toHaveAttribute('type', 'search');
    });

    test('should render file input', () => {
      render(<Input type='file' />);
      const input = document.querySelector('input[type="file"]');

      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveClass('file:border-0', 'file:bg-transparent');
    });
  });

  describe('Accessibility', () => {
    test('should support ARIA attributes', () => {
      render(<Input aria-describedby='help-text' aria-invalid='true' aria-required='true' />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'help-text');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    test('should be focusable', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');

      input.focus();
      expect(document.activeElement).toBe(input);
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <Input data-testid='input1' />
          <Input data-testid='input2' />
        </div>
      );

      const input1 = screen.getByTestId('input1');
      const input2 = screen.getByTestId('input2');

      await user.tab();
      expect(document.activeElement).toBe(input1);

      await user.tab();
      expect(document.activeElement).toBe(input2);
    });
  });

  describe('Validation', () => {
    test('should show required validation', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('required');
    });

    test('should handle pattern validation', () => {
      render(<Input pattern='[0-9]+' title='Numbers only' />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('pattern', '[0-9]+');
      expect(input).toHaveAttribute('title', 'Numbers only');
    });

    test('should handle min/max for number inputs', () => {
      render(<Input type='number' min='0' max='100' />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty className', () => {
      render(<Input className='' />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass('flex'); // Still has default classes
    });

    test('should handle undefined type', () => {
      render(<Input type={undefined} />);
      const input = screen.getByRole('textbox');

      // Should default to text input
      expect(input).toHaveAttribute('type', 'text');
    });

    test('should handle special characters in input', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');

      const specialText = '!@#$%^&*()_+-={}|[]\\:";\'<>?,./ àáâãäå';
      await user.type(input, specialText);

      expect(input).toHaveValue(specialText);
    });
  });
});
