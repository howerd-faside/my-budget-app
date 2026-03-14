import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
export default function Portal({ children }) {
  return createPortal(children, document.body);
}

Portal.propTypes = {
  children: PropTypes.node.isRequired,
};
