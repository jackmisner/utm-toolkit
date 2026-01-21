import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UtmProvider, useUtmContext } from '../../src/react/UtmProvider';

// Test component that uses the context
function TestConsumer() {
  const { utmParameters, isEnabled, hasParams, appendToUrl } = useUtmContext();

  return (
    <div>
      <span data-testid="enabled">{String(isEnabled)}</span>
      <span data-testid="hasParams">{String(hasParams)}</span>
      <span data-testid="params">{JSON.stringify(utmParameters)}</span>
      <span data-testid="appendedUrl">
        {appendToUrl('https://example.com/share')}
      </span>
    </div>
  );
}

describe('UtmProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', {
      href: 'https://example.com',
      search: '',
    });
  });

  it('provides UTM context to children', () => {
    render(
      <UtmProvider>
        <TestConsumer />
      </UtmProvider>
    );

    expect(screen.getByTestId('enabled').textContent).toBe('true');
  });

  it('passes config to hook', () => {
    render(
      <UtmProvider config={{ enabled: false }}>
        <TestConsumer />
      </UtmProvider>
    );

    expect(screen.getByTestId('enabled').textContent).toBe('false');
  });

  it('provides stored params to context', () => {
    sessionStorage.setItem('utm_parameters', '{"utm_source":"provider_test"}');

    render(
      <UtmProvider>
        <TestConsumer />
      </UtmProvider>
    );

    expect(screen.getByTestId('params').textContent).toBe(
      '{"utm_source":"provider_test"}'
    );
    expect(screen.getByTestId('hasParams').textContent).toBe('true');
  });

  it('auto-captures on mount with captureOnMount true', () => {
    vi.stubGlobal('location', {
      href: 'https://example.com?utm_source=auto_capture',
      search: '?utm_source=auto_capture',
    });

    render(
      <UtmProvider config={{ captureOnMount: true }}>
        <TestConsumer />
      </UtmProvider>
    );

    expect(screen.getByTestId('params').textContent).toBe(
      '{"utm_source":"auto_capture"}'
    );
  });

  it('uses custom storage key', () => {
    sessionStorage.setItem('custom_provider_key', '{"utm_source":"custom"}');

    render(
      <UtmProvider config={{ storageKey: 'custom_provider_key' }}>
        <TestConsumer />
      </UtmProvider>
    );

    expect(screen.getByTestId('params').textContent).toBe('{"utm_source":"custom"}');
  });

  it('appendToUrl works through context', () => {
    sessionStorage.setItem('utm_parameters', '{"utm_source":"context_test"}');

    render(
      <UtmProvider>
        <TestConsumer />
      </UtmProvider>
    );

    expect(screen.getByTestId('appendedUrl').textContent).toBe(
      'https://example.com/share?utm_source=context_test'
    );
  });

  it('applies shareContextParams', () => {
    sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

    render(
      <UtmProvider
        config={{
          shareContextParams: {
            default: { utm_medium: 'share' },
          },
        }}
      >
        <TestConsumer />
      </UtmProvider>
    );

    const url = screen.getByTestId('appendedUrl').textContent;
    expect(url).toContain('utm_source=test');
    expect(url).toContain('utm_medium=share');
  });
});

describe('useUtmContext', () => {
  it('throws when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useUtmContext must be used within a UtmProvider');

    consoleSpy.mockRestore();
  });
});

describe('UtmProvider with actions', () => {
  // Test component that exposes actions
  function TestConsumerWithActions() {
    const { utmParameters, capture, clear, hasParams } = useUtmContext();

    return (
      <div>
        <span data-testid="params">{JSON.stringify(utmParameters)}</span>
        <span data-testid="hasParams">{String(hasParams)}</span>
        <button data-testid="capture" onClick={capture}>
          Capture
        </button>
        <button data-testid="clear" onClick={clear}>
          Clear
        </button>
      </div>
    );
  }

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('capture action works through context', () => {
    vi.stubGlobal('location', {
      href: 'https://example.com?utm_source=action_test',
      search: '?utm_source=action_test',
    });

    render(
      <UtmProvider config={{ captureOnMount: false }}>
        <TestConsumerWithActions />
      </UtmProvider>
    );

    expect(screen.getByTestId('params').textContent).toBe('null');

    act(() => {
      screen.getByTestId('capture').click();
    });

    expect(screen.getByTestId('params').textContent).toBe(
      '{"utm_source":"action_test"}'
    );
  });

  it('clear action works through context', () => {
    sessionStorage.setItem('utm_parameters', '{"utm_source":"to_clear"}');

    render(
      <UtmProvider>
        <TestConsumerWithActions />
      </UtmProvider>
    );

    expect(screen.getByTestId('hasParams').textContent).toBe('true');

    act(() => {
      screen.getByTestId('clear').click();
    });

    expect(screen.getByTestId('hasParams').textContent).toBe('false');
    expect(screen.getByTestId('params').textContent).toBe('null');
  });
});

describe('nested providers', () => {
  function InnerConsumer() {
    const { utmParameters } = useUtmContext();
    return <span data-testid="inner">{JSON.stringify(utmParameters)}</span>;
  }

  it('inner provider overrides outer', () => {
    sessionStorage.setItem('outer_key', '{"utm_source":"outer"}');
    sessionStorage.setItem('inner_key', '{"utm_source":"inner"}');

    render(
      <UtmProvider config={{ storageKey: 'outer_key' }}>
        <UtmProvider config={{ storageKey: 'inner_key' }}>
          <InnerConsumer />
        </UtmProvider>
      </UtmProvider>
    );

    expect(screen.getByTestId('inner').textContent).toBe('{"utm_source":"inner"}');
  });
});
