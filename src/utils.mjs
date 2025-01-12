/** **********************************************************
 *
 * @Author: Andreas Paepcke
 * @Date:   2025-01-07 17:40:48
 * @Last Modified by:   Andreas Paepcke
 * @Last Modified time: 2025-01-09 18:37:24
 *
 ************************************************************/
/**
 * 
 */

import { MsgUUID } from "../msg_generator.mjs";

/* ---------------- Class EventListenable --------------

/**
 * Intended to be subclassed by user defined classes.
 * This mixin allows adding event listeners, and dispatching
 * events to instances of the subclasses as if they were
 * DOM elements. Example:
 * 
 *       MyClass extends EventListenable {
 *           // If subclass has a constructor,
 * 			 // remember to call super's constructor!
 * 
 * 			 do_stuff() {
 *               ...
 *           }
 * 		 }
 * 
 *   Elsewhere:
 *
 *       my_callback_func(e) => console.log(`Received event ${e}`)
 * 
 *       my_obj = MyClass();
 *       my_obj.addEventListener('my_event', my_callback_func)
 *       my_obj.dispatchEvent(new MyEvent())
 */

class EventListenable {
	
   /*------------------------------ 
    | Constructor 
    ----------------*/
	
    constructor() {  
	    this.events = {};
  	}

   /*------------------------------ 
    | addEventListener 
    ----------------*/

	addEventListener(action_enum, callback) {

		// Is a callback chain (array) already
		// defined for this action? If not,
		// init to empty array:
	  	this.events[action_enum] = this.events[action_enum] || [];

	  	// Is the exact same callback function already
	  	// defined for this event? If so, don't add another:
	  	
	  	for (const existing_callback of this.events[action_enum]) {
			  if (existing_callback.toString() == callback.toString())
			  	return;
		  }
	  	
	  	// Add the new callback
	  	this.events[action_enum].push(callback);
	}
	
   /*------------------------------ 
    | removeEventListener 
    ----------------*/
	
	removeEventListener(event_name, callback=null) {
		// Do we have a callback chain for this entry type?
		evt_entry = this.events[event_name];
		if (evt_entry === undefined) return;
		cb_idx = evt_entry.indexOf(callback);
		// Was the callback found?
		if (cb_idx == -1) return
		// Remove the callback:
		evt_entry.splice(cb_idx, 1)
	}	
}

/* ---------------- Class Waitlist --------------

/**
 * Used to keeping track of expected server responses,
 * and associated timeouts.
 * 
 * NOTE: a subclass MessageWaitlist specializes on 
 *       waitlist keys that are Message objects.
 */
class Waitlist {
	
	/*------------------------------ 
	 | Constructor 
	 ----------------*/
	
	constructor() {
		this.waitSet = new Map();
	}
	
	/*------------------------------ 
	 | add
	 ----------------*/

	/**
 	 * Add an entry that represents an outstanding
	 * response from the server. 
	 * 
	 * The req_msg_id must be the id of the message 
	 * that delivered the request to the server.
	 * 
	 * The resolve arg must be a function to call upon
	 * I.e. the reception of a message from the server 
	 * with reqMsgId in its req_id field.
	 * 
	 * The reject arg must be a function to call upon
	 * failure, most commonly a timeout because the server
	 * does not respond as expected.
	 *
	 * Optionally, a timeout may be specified: 
	 *    delay      : timeout in msec; or null for no timeout
	 *    err_msg    : a message to pass to the reject function
	 *                    if timeout occurs.
     *
	 * This method adds an entry to the waitSet that is keyed
	 * to the reqMsgId. The value will be the resolve/reject
	 * methods, and the timer, if one was requested.
	 * 
	 * 
	 * @param {Any} waitKey - any key that works with a Map 
	 * @param {function} resolve - function to call when a dispatchEvent
	 *     succeeds in finding an entry in the wait list 
	 * @param {function} reject - function to call on timeout
	 * @param {object} options - timeout information
	 * @param {{number | TimeoutDuration}} - timeout delay in milliseconds
	 * @param {string=} - error message upon timeout
	 */
	add(waitKey, resolve, reject, {delay = null, errMsg = '', callback = null} = {} ) {

		let timer;
		if (delay !== null) {
			if (typeof(delay) != 'number') {
				if (delay.explicit_val === undefined) {
					throw TypeError(`Delay must be a number of milliseconds, or a TimeoutDuration, not ${delay}`);
				} else {
					delay = delay.explicit_val;
				}
			}
			timer = setTimeout(() => {alert(`The server did not respond within ${delay}ms`); reject}, 
							   delay, 
							   new Error(errMsg));
		} else {
			timer = null;
		}

		this.waitSet.set(waitKey, {"resolve" : resolve, 
								   "reject"  : reject,
								   "callback": callback,
								   "timer"   : timer});
	}
	
   /*------------------------------ 
    | remove 
    ----------------*/
    
	/**
	 * Removes an entry from the waitlist.
	 * 
	 * @param {MsgUUID} waitKey is the key into the waitlist.
	 */
    remove(waitKey) {
		let waitEntry = this.waitSet[waitKey];
		if (waitEntry === undefined) return;
		// Stop timeout if one is running:
		if (waitEntry.timer !== null) { 
			clearTimeout(waitEntry.timer);
		}	
		delete this.waitSet[waitKey];
	}
	
   /*------------------------------ 
    | dispatchEvent
    ----------------*/

	/**
	* Called to resolve the promise associated with an
	* entry. Called in particular when a message from the server 
	* arrives that is a response to an earlier msg of ours.
	*
	* Calls the resolve function associated with the entry.
	*
	* It is OK to call this method with message IDs for which
	* no entry was added earlier. We just ignore such calls.
	*
    * @param {MsgUUID} waitKey is the key to the waitSet
	*     entry that holds the resolve function.
	* @param {Any} result is the result, such as a message 
    *	received from the server. It will be passed to the
	*	resolve message.
	* @param {Logger} logger if provided is used to report
	*   errors, such as not finding an entry in the waitSet.
	*/

	dispatchEvent(waitKey, result) {

		const entry = this.waitSet.get(waitKey);
		if (entry === undefined) {
			return;
		}
		try {
			clearTimeout(entry.timer);
		} catch(error) {
			// No timer was set.
		}

		// Remove the entry from the waitlist:
		this.remove(waitKey)

		// Execute callback if requested:
		if (['undefined', null].includes(entry.callback)) {
			entry.resolve(result);
		} else {
			entry.resolve(entry.callback(result));
		}
		
	}
}

/* -------------- MessageWaitlist ------------- */

/**
 * A Waitlist subclass that allows instancses of Message
 * to function as keys. The class is needed, because two
 * MsgUUIDs, which identify Message objects may be functionally
 * equal, yet be different objects. 
 */
class MessageWaitlist extends Waitlist {

   /*------------------------------ 
    | add
    ----------------*/

	/**
	 * 
	 * @param {Message} msg - Message instance to use as key
	 * @param {Function} resolve - function to call if server
	 * 	responds
	 * @param {Function} reject - function to call in case
	 * 	of timeout
	 * @param {object} options - timeout information
	 * @param {number=} options.delay - optional timeout delay
	 * @param {number=} options.errMsg - optional timeout delay
	 */
	add(msg, resolve, reject, {delay = null, 
							   errMsg = '',
							   callback = null,
							   nullReqIdIsError = true}) {
		if ([undefined, null].includes(msg.req_id)) {
			if (nullReqIdIsError) {
				throw TypeError("Adding callback requires a msg req_id. Set nullReqIdIsError to false to just return.")
			}
			return;
		}
		const key = msg.req_id.toString();
		super.add(key, resolve, reject, {delay : delay, 
									     errMsg : errMsg,
										 callback : callback
										});

	}

   /*------------------------------ 
    | remove
    ----------------*/

	/**
	 * Removes an entry from the waitlist.
	 * 
	 * @param {Message} msg - is the key into the waitlist.
	 */
    remove(msg) {
		if ([undefined, null].includes(msg.req_id)) {
			return;
		}
		const key = msg.req_id.toString();
		super.remove(key);
	}

   /*------------------------------ 
    | dispatchEvent
    ----------------*/

	/**
	 * Expects a Message instance for the key. Extracts
	 * the message's UUID, and then the ID string from
	 * that UUID. 
	 * 
	 * Calls super with the UUID string as key, and 
	 * sets the result argument to be the passed-in message.
	 * 
	 * @param {Message} msg - a Message instance that came in from the server.
	 */
	dispatchEvent(msg) {
		if ([undefined, null].includes(msg.req_id)) {
			return;
		}
		const key = msg.req_id.toString();
		super.dispatchEvent(key, msg);
	}


}


/* -------------- Class Stack ------------- */	 

class Stack {

    constructor() {
        this.items = [];
    }
    
    push(element) {
        this.items.push(element);
    }
    
    pop() {
        if (this.isEmpty()) return null;
        return this.items.pop();
    }
    
    peek() {
        if (this.isEmpty()) return null;
        return this.items[this.items.length - 1];
    }
    
    isEmpty() {
        return this.items.length === 0;
    }
    
    size() {
        return this.items.length;
    }
    
    clear() {
        this.items = [];
    }
}

/* -------------- Class Utils ------------- */	 

class Utils {
	
	// Textarea background colors for active and inactive states:
	static ACTIVE_BACKGROUND   = 'White';
	static ACTIVE_COLOR        = 'Black';
	//static INACTIVE_BACKGROUND = 'LightSteelBlue';
	static INACTIVE_BACKGROUND = 'Gray';
	static INACTIVE_COLOR      = 'White';

	// Send-paper-airplane color for active and inactive states:
	static ACTIVE_SEND_COLOR   = 'Black';
	static INACTIVE_SEND_COLOR = 'LightGray';

   /*------------------------------ 
    | setWidgetActiveState
    ----------------*/

	/**
	 * Given a UI widget, gray it out, and disable it,
	 * or turn it on. 
	 * 
	 * @param {UIElement} widget UI widget such as a button
	 * @param {bool} beActive
	 */
	static setWidgetActiveState(widget, beActive) {
		if (beActive) {
			if (this.isSendIcon(widget)) {
				widget.style.color = Utils.ACTIVE_SEND_COLOR;
				widget.readOnly    = false;
				return;
			} else if (this.isGradeMenu(widget)) {
				widget.style.visibility = "visible";
				return;
			}
			widget.style.backgroundColor = Utils.ACTIVE_BACKGROUND;
			widget.style.color           = Utils.ACTIVE_COLOR;
			widget.disabled = false; // Enable the button
			widget.readOnly = false;
		} else { // Be inactive
			if (this.isSendIcon(widget)) {
				widget.style.color = Utils.INACTIVE_SEND_COLOR;
				widget.readOnly    = true;
				return;
			}  else if (this.isGradeMenu(widget)) {
				widget.style.visibility = "hidden";
				return;
			}
			widget.style.backgroundColor = Utils.INACTIVE_BACKGROUND;
			widget.style.color           = Utils.INACTIVE_COLOR;
			widget.disabled = true; // Disable the button
			widget.readOnly = true;
		}
	}

   /*------------------------------ 
    | setWidgetHidden
    ----------------*/

	static setWidgetHidden(widget, isHidden, options) {
		if (isHidden) { // Should not be visible
			if (options.claimSpace !== undefined) {
				// Make the widget not take space in the layout:
				widget.style.display = "none";
				return;
			} else { // hide, but keep the display space open
				widget.style.visibility = "hidden";
				return;
			}
		} else { // should be visible
			// Make the widget take space in the layout:
			widget.style.display = "";
			// Ensure it's not hidden:
			widget.style.visibility = "visible";
		}
	}

	/*------------------------------ 
    | getWidgetActiveState
    ----------------*/

	/**
	 * Given a widget, return whether it is 
	 * enabled (return true), or disabled (return false)
	 * 
	 * @param {UIElement} widget whose state is to be returned 
	 * @returns {bool} state of widget
	 */

	static getWidgetActiveState(widget) {
		if (widget.classList.contains('grayed-out'))
			return false 
		else 
			return true
	}

   /*------------------------------ 
    | isSendIcon
    ----------------*/

	static isSendIcon(widget) {
		return widget.classList.contains("fa-paper-plane");
	}

   /*------------------------------ 
    | isGradeMenu
    ----------------*/

	static isGradeMenu(widget) {
		const id = widget.id;
		if (['ptSaysGradeMenu', 
	 		 'thSaysGradeMenu',
			 'aiAltGradeMenu',
			 'aiComparesGradeMenu'
		].includes(id)) {
			return true;
		}
		return false;
	}


	/*------------------------------ 
    | obj_var_names
    ----------------*/
    
    /**
	 * Given an object, return an array of
	 * its immediate instance variable names.
	 */
	
	static obj_var_names(o) {
		if (typeof(o) != 'object') {
			throw new TypeError(`Must provide an object, not '${o}'`);
		}
		return o.constructor.getOwnPropertyNames(o);
	}
	
   /*------------------------------ 
    | obj_length
    ----------------*/
    
    /**
	 * Returns number of instance variables of given object
	 */
	
	static obj_length(o) {
		return this.obj_var_names(o).length;
	}
	
   /*------------------------------ 
    | obj_items
    ----------------*/
    
    /**
	 * Return a list of key/value pairs of the obj.
	 * Ex: given 
	 *     {"foo" : 10, "bar" : 20"}, this method
	 * returns
	 *     [ [ 'foo', 10 ], [ 'bar', 20 ] ]
	 * 
	 * As in Python dict.items()
	 */
	
	static obj_items(o) {
		if (typeof(o) != 'object') {
			throw new TypeError(`Must provide an object, not '${o}'`);
		}
		return o.constructor.entries(o);
	}	
	
   /*------------------------------ 
    | obj_keys
    ----------------*/

    /**
	 * Return list of instance variable names,
	 * as in Python dict.keys().
	 *
	 * @param {object} obj whose property names are to be returned
	 * @returns {string[]} list of values for all the object's names
	 * @throws TypeError if item is not an object
	 */
    
    static obj_keys(obj) {
		if (typeof(obj) != 'object') {
			throw new TypeError(`Must provide an object, not '${o}'`);
		}
		return obj.constructor.keys(obj);
	}
	
   /*------------------------------ 
    | obj_values
    ----------------*/
    
    /**
	 * Return list of instance variable values,
	 * as in Python dict.values().
	 * 
	 * @param {object} obj whose values are to be returned
	 * @returns {*[]} list of values for all the object's names
	 * @throws TypeError if item is not an object
	 */
    
    static obj_values(obj) {
		if (typeof(obj) != 'object') {
			throw new TypeError(`Must provide an object, not '${obj}'`);
		}
		return obj.constructor.values(obj);
	}
	
	/*------------------------------ 
	 | is_uuid 
	 ----------------*/

	/**
	 * Returns true if the given argument is
	 * either a string like:
	 *    '28a423ab-3cc3-418f-bb67-a119b8058b49'
	 * or an MsgUUID instance.
	 * 
	 * If caller wishes only to test for whether or
	 * not their arg is a properly formatted uuid
	 * string, set the string_only parm to true. 
	 * Default: either string or MsgUUID instance are
	 * recognized as OK.
	 * 
	 * @param {(MsgUUID | string)} item the item to be examined 
	 * @param { boolean }  [string_only] whether only a
	 * 	uuid-formatted string is acceptable:  
	 * @returns {boolean} whether or not item is either 
	 * 	a properly formatted uuid, or an instance of MsgUUID.
	 */
	static is_uuid(item, string_only=false) {
		
		// Is caller wants item to qualify only
		// if it is a string: decide right now:
		if (string_only && item.constructor.name != 'String') {
			return false;
		}

		// May either be a MsgUUID instance, or
		// a uuid string. Note: to get the class
		// in which a static method is define, must
		// use x.name, not x.constructor.name, b/c 
		// the latter returns 'Function':
		let str;
		if (item.constructor.name == 'MsgUUID') {
			str = item.uuid_str;
		// Else must be a string:
		} else if (item.constructor.name != 'String') {
			return false
		} else {
			str = item;
		}
		const is_uuid_pat = /^[^-]{8}-[^-]{4}-[^-]{4}-[^-]{4}-[a-z0-9]{12}$/;
		let the_match = str.match(is_uuid_pat);
		return the_match !== null;
	 }
	 
   /*------------------------------ 
    | is_array
    ----------------*/
    
    /**
	 * There is a built-in  Array.isArray(), but 
	 * importing that in both node.js and browsers
	 * is finicky. So forget it:
	 * 
	 * @param {*} item the item to be tested
	 * @returns {boolean} whether or not item is an array 
	 */
    
    static is_array(item) {
		try {
			return item.constructor.name == 'Array';
		} catch (e) {
			return false;
		}
	}

	/*------------------------------ 
	 | setsEqual
	 ----------------*/

	 /**
	  * The JavaScript Set class has no built-in equality test.
	  * This method returns true if the given two sets have the
	  * same number of elements, and those element are the same,
	  * regardless of their order in the sets.
	  * 
	  * @param {Set} set1 - first set to compare
	  * @param {Set} set2 - second set to compare against
	  * @returns {Boolean}
	  */
	 static setsEqual(set1, set2) {
		if (set1.size !== set2.size) return false;
		return [...set1].every(item => set2.has(item));
	 }
	
   /*------------------------------ 
    | class_named
    ----------------*/
    
    /**
	 * Given the name of a class, and a list of class objects, 
	 * returns the respective class object. If the name is not 
	 * that of a class that is the provided in the classes array,
	 * raises TypeError.
	 * 
	 * What we really want is to obtain a list of values in
	 * the caller's scope. We would then try to find the value
	 * that is a class with the desired name. But this seems
	 * impossible in JS. 
	 * 
	 * The 'solution' here puts on the caller the burden of keeping 
	 * a list of class objects that are candidates. 
	 * 
	 * @param {string} cls_nm the name of the class object to be returned
	 * @param {[Class]} classes a list of class objects who are candidates
	 * 		for having the desired name.
	 * @param {(null | string)} required_method if provided, names a 
	 * 		method that the caller requires the found class to provide.
	 * @returns {Object} a corresponding class object
	 * @throws {TypeError} if nm is not a class, is a class, but does
	 * 		not have any property called required_method (if required),
	 * 		or does have a property named required_method, but that
	 * 		property is not a function.
	 */
    static class_named(cls_nm, classes, required_method=null) {

		if (classes.constructor.name != 'Array') {
			throw TypeError(`The classes arg must be a list of class objects; yet ${classes} was passed`);
		}
		let cls_obj = classes.find((cls) => cls.name == cls_nm);
		if (cls_obj === undefined) {
			let msg = `Could not find a class named ${cls_nm}`;
			throw ReferenceError(msg);
		}
			
		// User requires a particular method to be present?
		if (required_method != null) {
			if (! cls_obj.hasOwnProperty(required_method)) {
				let msg = `Arg ${cls_nm} is a class, but the class has no property ${required_method}`;
				throw ReferenceError(msg);
			}
			// Arg required_method is a property of the class,
			// but is it a function?
			try {
				let prop_type = typeof(Reflect.getOwnPropertyDescriptor(cls_obj, required_method).value)
				if (prop_type != 'function') {
					let msg = `Arg ${cls_nm} is a class, but ${required_method} is not one of its methods`
					throw TypeError(msg);
				}
			} catch(e) {
				// the class has not property with name given by required_method:
				throw TypeError(`Arg ${cls_nm} is a class, but ${required_method} is not one of its properties`) 
			}
		}
		
		return cls_obj;
	}
	
   /*------------------------------ 
    | item_from_json
    ----------------*/

	/**
	 * Given a value, return a new, recursively JSON decoded
	 * value.
	 */
    item_from_json(item) {
		
		if (['undefined', 'boolean', 'number',
			 'bigint', 'symbol'].includes(typeof(item))) {
				 return item;
			 }
		// Is it an enum member?
		if (item.is_enum) {
			return item;
		}	 

		if (typeof(item) == 'string') {
			try {
				let decoded = JSON.parse(item);
				return decoded;
			} catch(SyntaxError) {
				return item;
			} 
		}
		
		if (typeof(item) === 'object') {
			
			let new_obj = Object.create(item);
	        for (const key in item) {
				const value = item[key];
				new_obj[key] = this.item_from_json(value);
			}
			return new_obj;
		}
	}

   /*------------------------------ 
    | userConfirmation
    ----------------*/

	/** Asynchronously prompts user for confirmation, providing
	 * the content of the prompt arg as explanation for what is
	 * being confirmed. With prompt === "Erase disk", popup
	 * will say:
	 *      Please confirm: Erase disk
	 * 
	 * Usage:
	 *     await Utils.userConfirmation("Erase disk")
	*/
	static async userConfirmation(prompt) {
		return new Promise(resolve => {
		  const result = confirm(`Please confirm: ${prompt}`);
		  resolve(result);
		});
	  }

   /*------------------------------ 
    | trimChars
    ----------------*/

	/**
	 * Removes a set of given characters from both ends 
	 * of a string
	 * 
	 * @param {str} the_str 
	 * @param {str} chars 
	 * @returns {str} the_string with all characters in chars removed from both ends.
	 */
	static trimChars(the_str, chars) {
		return the_str.replace(new RegExp(`^[${chars}]+|[${chars}]+$`, 'g'), '');
	   }	  

} // end class Utils


export { Utils, MessageWaitlist, Waitlist, Stack, EventListenable };