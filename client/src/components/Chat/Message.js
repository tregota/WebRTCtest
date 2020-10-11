import React from 'react';
import { withStyles } from '@material-ui/core/styles';

const styles = {
  chatLine: {
    display: "flex",
    marginTop: "30px"
  },

  chatMessage: {
    marginRight: "50px",
    padding: "10px 20px",
    textAlign: "left",
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
    marginLeft: "50px",
    padding: "10px 20px",
    textAlign: "left",
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
    marginBottom: "-20px",
    marginRight: "-5px",
    marginLeft: 0,
    margin: "0 0 0 -8.5px",
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
      { outgoing && <div className={classes.columnLeft} /> }
      <div className={outgoing ? classes.columnRight : classes.columnLeft} >
        { !outgoing && <div className={classes.chatUser}>{user ? user.name + (user.online ? "" : "*") : userId}</div>}
        <div className={outgoing ? classes.myMessage : classes.chatMessage}>{message.split('\n').map((p, idx) => <div key={idx}>{p}</div>)}</div>
      </div>
      { !outgoing && <div className={classes.columnRight} /> }
    </div>
  )
};

export default withStyles(styles)(Message);
