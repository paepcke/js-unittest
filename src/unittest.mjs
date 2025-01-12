/**
 * Facility roughly equivalent to Python Unittest.
 * 
 * Usage:
 *   import { TestCase, Unittest } from '.../unittest.mjs'
 *   
 *   class MyTester extends TestCase {
 *  	constructor() {
 *  		super();
 * 
 *  		this.some_val1    	= 'foo';
 *  		this.some_val2      = 'bar';

 *  		super.run_tests(this);
 *  		console.log("Tests done");
 *  	}
 * 
 *      test_feature1() {
 *          super.assertEqual(1,1);
 *          super.assertObjsEqual({'foo', 10, 'bar' :20},
 * 								  {'foo', 10, 'bar' :20})
 *          super.assertTrue(1==1);
 * 			super.assertDefined(this.some_val1);
 * 			super.raises(my_func(3), TypeError)
  *      }
 * }
 * 
 * Utilities used only for testing, such as finding
 * tests in the file hierarchy.
 */

import fs from "fs";

import { AssertionError, NotFoundError } from "../common/errors.mjs";
import { Utils } from "../common/utils.mjs";

/* ------------------ Class TestCase ------------ */

class TestCase {
	
	constructor() {
	}

	/* -------------- Assertion Conveniences ----------------	

	/*------------------------------ 
	 | assertEqual
	 ----------------*/
	 
	 /** Test equality of non-object items. 
	  * If strictly is True, '===' is used,
	  * else '=='
	  */
	 assertEqual(arg1, arg2, strictly=true) {
		 if (strictly) {
			 if (arg1 !== arg2) {
			 	// Empty arrays show up as black space; fix that:
			 	if (Array.isArray(arg1) && arg1.length == 0) {
					 arg1 = '[]'
				 }
			 	if (Array.isArray(arg2) && arg2.length == 0) {
					 arg2 = '[]'
				 }	
				 	
			 	throw new AssertionError(`${arg1} !== ${arg2}`)
			 } else {
				 // Args are ===
				 return
			 }
		 }
		 else {
			// Caller wants just == comparison:
		 	if (arg1 != arg2)
		 		throw new AssertionError(`${arg1} != ${arg2}`)
		 }
	 }

	/*------------------------------ 
	 | assertTrue
	 ----------------*/
	 
	 assertTrue(arg1) {
		 if (!arg1)
		 	throw new AssertionError(`${arg1} is False instead of True`)
	 }

	/*------------------------------ 
	 | assertFalse
	 ----------------*/
	 
	 assertFalse(arg1) {
		 if (arg1)
		 	throw new AssertionError(`${arg1} is True instead of False`);
	 }

	/*------------------------------ 
	 | assertObjsEqual
	 ----------------*/
	 
	 assertObjsEqual(obj1, obj2) {

		 if (typeof(obj1) == 'undefined' || typeof(obj2) == 'undefined') {
			 let msg = 'One or both objects are undefined';
			 throw new AssertionError(msg);
			 
		 }
		 const obj1_keys = Object.getOwnPropertyNames(obj1);
		 const obj2_keys = Object.getOwnPropertyNames(obj2);
		 if (obj1_keys.length != obj2_keys.length) 
		 	throw new AssertionError(`Number of elements in objects differ`);

		 for (const key of Object.getOwnPropertyNames(obj1))
		     if (obj1[key] != obj2[key]) {
		     	// See whether the two values are themselves
		     	// objects nested under the keys:
		     	try {
		     		this.assertObjsEqual(obj1[key], obj2[key]);
		     	} catch(e) {
					 throw new AssertionError(`Object value obj1.${key} != obj2.${key}: ${obj1[key]} != ${obj2[key]}`)
				}
		     }
	 }		 

	/*------------------------------ 
	 | assertDefined
	 ----------------*/
	 
	 assertDefined(value) {
		 if (value === undefined)
		 	throw new AssertionError(`Value is undefined`);
	 }
	 
   /*------------------------------ 
    | assertListsEqual 
    ----------------*/
    
    /**
	 * Checks list lengths, and pairwise ===
	 */
    assertListsEqual(list1, list2) {
		
		const l1_class = list1.constructor.name;
		const l2_class = list2.constructor.name;
		
		if (! list1 instanceof Array)
			throw new AssertionError(`List1 argument is not a list, but: '${l1_class}'`)
		
		if (! list2 instanceof Array)
			throw new AssertionError(`List2 argument is not a list, but: '${l2_class}'`)
				
		if (list1.length != list2.length) {
			throw new AssertionError(`List length are unequal: ${list1.length} != ${list2.length}`);
		}
		
		for (let i = 0; i < list1.length; i++) {		
			const el1 = list1[i];
			const el2 = list2[i];
			// Is el1 itself a list?
			if (el1 instanceof Array) {
				// Recursive comparison (if el2 is not a list we'll throw error)
				this.assertListsEqual(el1, el2);
				continue;
			}
			if (el1 !== el2) {
				throw new AssertionError(`Lists differ in element ${idx}: ${list1[idx]} !== ${list2[idx]}}`)
			}
		}
	}
	 
	 
	/*------------------------------ 
	 | assertRaises
	 ----------------*/
	 
	 /**
	  * Confirms that calling func raises an expected
	  * exception exc. If func does not raise that exception,
	  * an assertion error is thrown.
	  */
	 assertRaises(func, exc, ...args) {
		 
		 try {
			 func(...args);
			 throw new AssertionError(`Should have thrown exception '${exc}'`);
		 } catch (e) {
			 try {
			 	if (e instanceof exc) return;
			 } catch(TypeError) {
				 const err_msg = `Usage: assertRaises(function, exceptionClass); but exc was ${exc}`;
				 throw new SyntaxError(err_msg);
			 }
			 throw new AssertionError(`Should have thrown exc type '${exc}', not ${typeof(e)}`);
		 }
	 }
	 
	 

	/* ---------------- Test File Finding --------------------

	/*------------------------------
	| find_test_files
	--------------------*/
		
	/** Call to discover tests, i.e. files under start_dir
	   whose name starts with 'test_'. Use next_test() to
	   access found files one by one.
	*/
	async find_test_files(start_dir = process.cwd()) {
		this.test_list = Utils.walkdir(start_dir);
		return this.test_list;
	}
	
	/*------------------------------
	| next_test_file
	--------------------*/
	
	next_test_file() {
		if (this.test_list.length == 0) {
			 return null;
		} else {
			 return this.test_list.pop();
		}
	}
	
	/*------------------------------
	| run_tests
	--------------------*/
	
	/** Find test methods in current file, i.e. in
	    file this class is inherited
	*/
	run_tests(test_case_subclass_inst) {
		let filter=(prop) => prop.startsWith('test')
		let test_funcs = Unittest.getMethods(test_case_subclass_inst, filter); 

		for (const test of test_funcs) {
			// Use call() so we can initialize 'this'
			// to be the instance of the subclass:
			test.call(test_case_subclass_inst)
		}
	}
}

/* ------------------ Class Unittest ------------ */

class Unittest {

	/*------------------------------
	| getMethods
	--------------------*/

	/**
	 * Given a class, or an instance of a class, return a list of methods
	 * on the class, or the instance's class.
	 * If filter is provided, only include props for which
	 * filter returns true. To search only for methods
	 * that start with 'test_':
	 * 
	 *     my_filter = (prop) => prop.startsWith('test_')
	 * 	   Util.getMethods(Foo, meth_filter=my_filter)
	 */

	static getMethods(get_from, meth_filter=null) {
		let the_class = null;
		// Instance, or class?
		if (typeof(get_from) == 'object')
			// It's an instance; get its class object
			the_class = get_from.constructor;
		else
		    // It's already a class object:
			the_class = get_from

		let method_names = Object.getOwnPropertyNames(the_class.prototype);
		let method_objs = [];
		let methods = null;
		if (meth_filter == null) {
			methods = method_names;
		} else {
			methods = method_names.filter(prop_name => meth_filter(prop_name))
		}			   
	    // Turn method names into function objecst:
	    for (const i in methods) {
			let meth_name = methods[i];
			method_objs.push(the_class.prototype[meth_name])
		}

		// The following do not work for replacing the loop above; don't know why:
	    //method_objs = methods.map(meth_name => the_class.prototype[meth_name])
	    //method_objs = methods.map(i => the_class.prototype[methods[i]])
	    return method_objs
	}

	/*------------------------------
	| walkdir
	--------------------*/
	
	static walkdir(location, filter_fn=null, ret_absolute=true) {
		return Utils._walkdir_helper([], location, filter_fn, ret_absolute);
	} 
	
	static _walkdir_helper(so_far, location, filter_fn=null, ret_absolute=true) {
		
		if (!fs.existsSync(location)) {
			throw new NotFoundError(`Location '${location}' was not found`)
		};
	    if (!fs.statSync(location).isDirectory()) {
	        throw new TypeError(`Arg 'location' must be a directory, not '${location}'`);
	    }
	    
	    let content = fs.readdirSync(location);
	    for (const entry of content) {
			let abs_path = `${location}/${entry}`;
			try {
		        if(fs.statSync(abs_path).isFile() &&
					(typeof(filter_fn) == 'function' ? filter_fn(entry) : true)) {
					ret_absolute ? so_far.push(abs_path) : so_far.push(entry)
					}
		        else {
		            so_far.push(...Utils._walkdir_helper(
							so_far, 
		                	abs_path, 
		                	filter_fn, 
		                	ret_absolute)
		            	)
		        }
		    }
		    catch(e) {
				// Happens for unusual files, such as symlinks:
				// ignore
				continue;
			}
	    };
	    return so_far;
	}
}	

export {Unittest, TestCase};
 
 /* ---------- Testing this Module --------------------- */
 
/* ***************************** 

async function test_discovery() {
	let test_fname  = null;
	let test_fname1 = null;
	let dir_name    = null
	try {
		dir_name = await mkdtemp('/tmp/tstcase_tst');
		test_fname = `${dir_name}/test_file.js`;
		
		console.log(`test_fname: '${test_fname}'`);
		
		let fd = await open(test_fname, 'w');
		await writeFile(fd, "foobar", {flush : true});
		
		let tester = new TestCase();
		tester.find_tests(dir_name);

		if (tester.test_list.length != 1) throw new Error("Should have 1 file.");		
		//console.log(`Queue length: ${tester.test_list.length}`);
		do {
		     var test_fn = tester.next_test();
			 console.log(`Test name: ${test_fn}`);
			 } while (test_fn !== null);
			 
		// Add another file:
		test_fname1 = `${dir_name}/test_file1.js`;
		let fd1 = await open(test_fname1, 'w');
		await writeFile(fd1, "bluebell", {flush : true});

		tester.find_tests(dir_name);
		if (tester.test_list.length != 2) throw new Error("Should have 2 file.");		
		
	} finally {
	     fs.rmSync(test_fname);
	     fs.rmSync(test_fname1);
	     fs.rmdirSync(dir_name);
	  }
	}

 test_this();
 
***************************** */

/* ------------------------------ */

/*
function test_assertions() {
	let my_test_case = new TestCase();
	
	// assertDefined
	
	my_test_case.assertDefined(my_test_case)
	my_test_case.assertEqual(1,1);
	try {
		my_test_case.assertEqual(1,2);
	} catch (e) {
		if (e instanceof AssertionError) {}
		else throw new AssertionError(`AssertEqual did not recognize inequality`);
	}
	
	// assertObjsEqual
	
	let obj1 = {"foo" : 10, "bar" : 20};
	let obj2 = {"foo" : 10, "bar" : 20};
	my_test_case.assertObjsEqual(obj1, obj2);
	
	let obj3 = {"foo" : 100, "bar" : 20};
	try {
		my_test_case.assertObjsEqual(obj1, obj3);
	} catch (e) {
		if (e instanceof AssertionError) {};
	}
	
	// assertRaises()
	try {
		my_test_case.assertRaises(() => null.method(), TypeError);
	} catch (e) {
		if (! e instanceof TypeError) {
			throw new AssertionError(`assertRaises did not raise correct error type`)
		}
		throw new AssertionError(`assertRaises did not raise an error`);
	}

	// assertListsEqual:
	
	const l1 = [1,2,3];
	const l2 = [1,2,3];
	my_test_case.assertListsEqual(l1,l2);
	
	const l3 = [[1,2],[1,2]];
	const l4 = [[1,2],[1,2]];
	my_test_case.assertListsEqual(l3,l4);
	my_test_case.assertRaises(
		() => my_test_case.assertListsEqual(l1,l4),
		AssertionError
	);
	
	// One more depth:
	const l5 = [l3, l4];
	const l6 = [l3, l4];
	my_test_case.assertListsEqual(l5,l6);
	
	// assertTrue
	my_test_case.assertTrue(3 == 3);
	
	console.log("Done assertions testing");
	
}

test_assertions();
------------------ */
/* ******************************* */

// Test file and method finding:

/* ------------ 
class Foo {
    meth1() {
    }

    test_meth2() {
    }

    test_meth3() {
    }
}
var i = new Foo()
var methods = Utils.getMethods(i)
for (const i in methods) console.log(`Type of Meth: '${typeof(methods[i])}'`)
	
var test_it = function() {
	let loc = '/Users/paepcke/tmp';
	let paths = Utils.walkdir(loc);
	console.log(`Number of files: ${paths.length}`);
}
test_it();
------------ */
