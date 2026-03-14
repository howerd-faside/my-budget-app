import { createContext, useContext } from 'react';

const NavigationContext = createContext(() => {});

export const useNavigate = () => useContext(NavigationContext);
export const NavigationProvider = NavigationContext.Provider;
