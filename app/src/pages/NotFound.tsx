import { Link } from 'react-router';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';

export const NotFound = () => (
  <Page>
    <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <Light state="out" size="lg" />
      <h1 className="text-3xl">Nothing here</h1>
      <p className="text-paper-soft">
        If someone sent you a lì xì, open the full link from their message, or{' '}
        <Link to="/c" className="underline underline-offset-4 hover:text-paper">
          paste it here
        </Link>
        .
      </p>
    </div>
  </Page>
);
