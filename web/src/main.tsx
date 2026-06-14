import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import App from './App';
import { awsConfig } from './aws-config';
import { useTheme } from './hooks/useTheme';
import './styles.css';

Amplify.configure(awsConfig);

function Root() {
  const { theme, toggle } = useTheme();
  return (
    <ThemeProvider colorMode={theme}>
      <Authenticator signUpAttributes={['email']}>
        {({ signOut, user }) => (
          <App
            signOut={signOut}
            userEmail={user?.signInDetails?.loginId}
            theme={theme}
            onToggleTheme={toggle}
          />
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
