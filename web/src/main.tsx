import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import App from './App';
import { awsConfig } from './aws-config';
import './styles.css';

Amplify.configure(awsConfig);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Authenticator signUpAttributes={['email']}>
      {({ signOut, user }) => (
        <App signOut={signOut} userEmail={user?.signInDetails?.loginId} />
      )}
    </Authenticator>
  </React.StrictMode>,
);
