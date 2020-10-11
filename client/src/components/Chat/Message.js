import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import User from './User';

const styles = {
  chatLine: {
    display: "flex",
    marginBottom: "25px"
  },

  chatMessage: {
    whiteSpace: 'pre',
    textAlign: 'left',
    padding: "10px 20px",
    position: "relative",
    background: "#000000",
    color: "#FFFFFF",
    fontFamily: "Arial",
    fontSize: "20px",
    borderRadius: "4px",
    boxShadow: "5px 5px 5px -3px rgba(163, 163, 163, 0.4)",
    "&:after": {
      content: '""',
      position: "absolute",
      display: "block",
      width: 0,
      zIndex: 1,
      borderStyle: "solid",
      borderWidth: "16px 17px 0 0",
      borderColor: "#000000 transparent transparent transparent",
      bottom: "-10px",
      left: "18px",
      marginLeft: "-8.5px",
    }
  },
  
  myMessage: {
    whiteSpace: 'pre',
    textAlign: 'left',
    padding: "10px 20px",
    position: "relative",
    background: "#11bf8f",
    color: "#FFFFFF",
    fontFamily: "Arial",
    fontSize: "20px",
    borderRadius: "4px",
    boxShadow: "5px 5px 5px -3px rgba(163, 163, 163, 0.4)",
    "&:after": {
      content: '""',
      position: "absolute",
      display: "block",
      width: 0,
      zIndex: 1,
      borderStyle: "solid",
      borderWidth: "16px 0 0 17px",
      borderColor: "#11bf8f transparent transparent transparent",
      bottom: "-10px",
      right: "18px",
      marginRight: "-8.5px",
    }
  },

  chatUser: {
    alignSelf: "flex-end",
    margin: "0 -5px -20px 0",
    fontWeight: "bold",
    textAlign: "left",
    position: "relative",
  },

  columnLeft: {
    display: "flex",
    position: "relative",
    flexGrow: 1,
  },
  columnRight: {
    display: "flex",
    position: "relative",
    flexGrow: 1,
    justifyContent: "flex-end"
  }
}

const Message = ({classes, users, userId, message, outgoing = false}) => {
  const user = users.find(u => u.id === userId);
  return (
    <div className={classes.chatLine}>
      <div className={outgoing ? classes.columnRight : classes.columnLeft} >
        { !outgoing && <div className={classes.chatUser}><User user={user} userId={userId} /></div>}
        <div className={outgoing ? classes.myMessage : classes.chatMessage}>{message}</div>
      </div>
    </div>
  )
};

export default withStyles(styles)(Message);
