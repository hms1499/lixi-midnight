import { Component, type ReactNode } from 'react';
import { Page } from './Layout';
import { Button, Notice } from './ui';

type Props = { readonly children: ReactNode; readonly onReload: () => void };

/**
 * A lazy page whose code fails to load (a tab left open across a redeploy, a dropped connection)
 * offers a reload instead of a blank page. Reloading keeps the URL, fragment included.
 */
export class LoadBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Page>
        <div className="max-w-xl space-y-4">
          <Notice tone="error">This page could not load. Lixi may have been updated since you opened it.</Notice>
          <Button type="button" onClick={this.props.onReload}>
            Reload
          </Button>
        </div>
      </Page>
    );
  }
}
