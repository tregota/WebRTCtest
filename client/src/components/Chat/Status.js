import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import User from './User';

const styles = {
  chatLine: {
    display: "flex",
    alignItems: "center",
    marginBottom: "10px"
  },

  status: {
    fontWeight: "bold",
    padding: "5px 20px",
    textAlign: "left",
    color: "#000",
    fontFamily: "Arial",
    background: "#fff",
    border: "1px solid black",
    borderRadius: "4px",
    boxShadow: "5px 5px 5px -3px rgba(163, 163, 163, 0.4)",
  },

  statusUser: {
    fontWeight: "bold",
    marginRight: "5px",
  },
}

const Status = ({classes, users, userId, status }) => {
  const user = users.find(u => u.id === userId);
  return (
    <div className={classes.chatLine}>
      <div className={classes.status}>
        { (user || userId) && <User user={user} userId={userId} />} {status}
      </div>
    </div>
  )
};

export default withStyles(styles)(Status);
