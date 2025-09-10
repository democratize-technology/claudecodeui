import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, buttonVariants } from '../../components/ui/button';

describe('Button Component', () => {
  describe('Rendering', () => {
    test('should render with default props', () => {
      render(<Button>Default Button</Button>);
      const button = screen.getByRole('button');

      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Default Button');
      expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
    });

    test('should render with custom className', () => {
      render(<Button className='custom-class'>Button</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('custom-class');
    });

    test('should forward ref correctly', () => {
      const ref = React.createRef();
      render(<Button ref={ref}>Button</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Variants', () => {
    test('should apply default variant styles', () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    test('should apply destructive variant styles', () => {
      render(<Button variant='destructive'>Delete</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground');
    });

    test('should apply outline variant styles', () => {
      render(<Button variant='outline'>Outline</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('border', 'border-input', 'bg-background');
    });

    test('should apply secondary variant styles', () => {
      render(<Button variant='secondary'>Secondary</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground');
    });

    test('should apply ghost variant styles', () => {
      render(<Button variant='ghost'>Ghost</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('hover:bg-accent', 'hover:text-accent-foreground');
    });

    test('should apply link variant styles', () => {
      render(<Button variant='link'>Link</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('text-primary', 'underline-offset-4', 'hover:underline');
    });
  });

  describe('Sizes', () => {
    test('should apply default size styles', () => {
      render(<Button>Default Size</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('h-9', 'px-4', 'py-2');
    });

    test('should apply small size styles', () => {
      render(<Button size='sm'>Small</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('h-8', 'px-3', 'text-xs');
    });

    test('should apply large size styles', () => {
      render(<Button size='lg'>Large</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('h-10', 'px-8');
    });

    test('should apply icon size styles', () => {
      render(<Button size='icon'>⚙️</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('h-9', 'w-9');
    });
  });

  describe('Interactions', () => {
    test('should handle click events', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('should be disabled when disabled prop is true', () => {
      const handleClick = jest.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    test('should support keyboard navigation', () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByRole('button');

      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Props Forwarding', () => {
    test('should forward all button props', () => {
      render(
        <Button type='submit' data-testid='custom-button' aria-label='Custom button' tabIndex={-1}>
          Custom Props
        </Button>
      );

      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('aria-label', 'Custom button');
      expect(button).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA role', () => {
      render(<Button>Accessible Button</Button>);
      const button = screen.getByRole('button');

      expect(button).toBeInTheDocument();
    });

    test('should support ARIA attributes', () => {
      render(
        <Button aria-describedby='help-text' aria-expanded='false'>
          ARIA Button
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('should have focus-visible styles when focused', () => {
      render(<Button>Focus Test</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-1');
    });
  });

  describe('buttonVariants Function', () => {
    test('should generate correct classes for default configuration', () => {
      const classes = buttonVariants();

      expect(classes).toContain('bg-primary');
      expect(classes).toContain('text-primary-foreground');
      expect(classes).toContain('h-9');
      expect(classes).toContain('px-4');
    });

    test('should generate correct classes for custom configuration', () => {
      const classes = buttonVariants({ variant: 'destructive', size: 'lg' });

      expect(classes).toContain('bg-destructive');
      expect(classes).toContain('text-destructive-foreground');
      expect(classes).toContain('h-10');
      expect(classes).toContain('px-8');
    });

    test('should merge custom className', () => {
      const classes = buttonVariants({ className: 'custom-class' });

      expect(classes).toContain('custom-class');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty children', () => {
      render(<Button></Button>);
      const button = screen.getByRole('button');

      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('');
    });

    test('should handle complex children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('IconText');
      expect(button.children).toHaveLength(2);
    });

    test('should handle undefined variant and size', () => {
      render(
        <Button variant={undefined} size={undefined}>
          Button
        </Button>
      );
      const button = screen.getByRole('button');

      // Should fall back to defaults
      expect(button).toHaveClass('bg-primary', 'h-9');
    });
  });
});
