import React from 'react';
import { withStyles } from '@material-ui/core/styles';

const styles = {
  online: {
    color: "#00ad5d"
  },
  offline: {
    color: "#b10000"
  },
  unknown: {
    color: "#888"
  }
}

const User = ({ classes, user, userId }) => {
  return (
    <span className={ !user ? classes.unknown : user.online ? classes.online : classes.offline }>
      { user ? user.name : userId }
    </span>
  )
};

export default withStyles(styles)(User);
