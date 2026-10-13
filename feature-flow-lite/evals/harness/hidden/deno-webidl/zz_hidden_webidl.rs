// Hidden acceptance tests for the deno-webidl scenario. The grader copies this file to
// core/zz_hidden_webidl.rs and adds `#[cfg(test)] mod zz_hidden_webidl;` to core/lib.rs.
#![allow(clippy::all)]

use crate::webidl::*;
use crate::JsRuntime;
use std::borrow::Cow;
use std::collections::HashMap;

fn conv<'a, T: WebIdlConverter<'a>>(
  scope: &mut v8::HandleScope<'a>,
  value: v8::Local<'a, v8::Value>,
  options: &T::Options,
) -> Result<T, WebIdlError> {
  T::convert(scope, value, Cow::Borrowed("prefix"), || Cow::Borrowed("context"), options)
}

fn js<'a>(scope: &mut v8::HandleScope<'a>, src: &str) -> v8::Local<'a, v8::Value> {
  let src = v8::String::new(scope, src).unwrap();
  let script = v8::Script::compile(scope, src, None).unwrap();
  script.run(scope).unwrap()
}

fn num<'a>(scope: &mut v8::HandleScope<'a>, n: f64) -> v8::Local<'a, v8::Value> {
  v8::Number::new(scope, n).into()
}

fn int(clamp: bool, enforce_range: bool) -> IntOptions {
  IntOptions { clamp, enforce_range }
}

#[test]
fn integers_modulo() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = IntOptions::default();
  for (v, want) in [(50.0, 50i8), (-10.0, -10), (130.0, -126), (-130.0, 126), (f64::NAN, 0), (-0.0, 0)] {
    let x = num(scope, v);
    assert_eq!(conv::<i8>(scope, x, &d).unwrap(), want, "i8 {v}");
  }
  for (v, want) in [(50.0, 50u8), (-10.0, 246), (260.0, 4), (3.7, 3), (-3.7, 253), (f64::INFINITY, 0)] {
    let x = num(scope, v);
    assert_eq!(conv::<u8>(scope, x, &d).unwrap(), want, "u8 {v}");
  }
  let x = num(scope, 70000.0);
  assert_eq!(conv::<u16>(scope, x, &d).unwrap(), 4464);
  let x = num(scope, 4294967296.0 + 5.0);
  assert_eq!(conv::<u32>(scope, x, &d).unwrap(), 5);
  let x = num(scope, 2147483648.0);
  assert_eq!(conv::<i32>(scope, x, &d).unwrap(), i32::MIN);
  let x = num(scope, -1.0);
  assert_eq!(conv::<u64>(scope, x, &d).unwrap(), u64::MAX);
  let x = num(scope, 9007199254740991.0);
  assert_eq!(conv::<i64>(scope, x, &d).unwrap(), 9007199254740991);
}

#[test]
fn integers_clamp() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let c = int(true, false);
  for (v, want) in [(130.0, 127i8), (-130.0, -128), (2.5, 2), (3.5, 4), (-2.5, -2), (f64::NAN, 0)] {
    let x = num(scope, v);
    assert_eq!(conv::<i8>(scope, x, &c).unwrap(), want, "i8 clamp {v}");
  }
  for (v, want) in [(260.0, 255u8), (-5.0, 0), (f64::INFINITY, 255)] {
    let x = num(scope, v);
    assert_eq!(conv::<u8>(scope, x, &c).unwrap(), want, "u8 clamp {v}");
  }
}

#[test]
fn integers_enforce_range() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let e = int(false, true);
  for v in [f64::INFINITY, -f64::INFINITY, f64::NAN, 130.0, -129.0] {
    let x = num(scope, v);
    assert!(conv::<i8>(scope, x, &e).is_err(), "i8 enforce {v}");
  }
  for v in [260.0, -1.0] {
    let x = num(scope, v);
    assert!(conv::<u8>(scope, x, &e).is_err(), "u8 enforce {v}");
  }
  let x = num(scope, 3.7);
  assert_eq!(conv::<u8>(scope, x, &e).unwrap(), 3);
  let x = num(scope, 9007199254740992.0);
  assert!(conv::<i64>(scope, x, &e).is_err(), "i64 past 2^53-1");
  let x = num(scope, 9007199254740992.0);
  assert!(conv::<u64>(scope, x, &e).is_err(), "u64 past 2^53-1");
}

#[test]
fn integers_from_other_types() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = IntOptions::default();
  let x = js(scope, "'3'");
  assert_eq!(conv::<u8>(scope, x, &d).unwrap(), 3);
  let x = js(scope, "'test'");
  assert_eq!(conv::<u8>(scope, x, &d).unwrap(), 0);
  let x = js(scope, "undefined");
  assert_eq!(conv::<u8>(scope, x, &d).unwrap(), 0);
  let x = js(scope, "true");
  assert_eq!(conv::<u8>(scope, x, &d).unwrap(), 1);
  let x = js(scope, "({ valueOf() { return 7 } })");
  assert_eq!(conv::<u8>(scope, x, &d).unwrap(), 7);
  let x = js(scope, "0n");
  assert!(conv::<u8>(scope, x, &d).is_err(), "bigint");
  let x = js(scope, "Symbol()");
  assert!(conv::<u8>(scope, x, &d).is_err(), "symbol");
  let x = js(scope, "({ valueOf() { throw new Error('boom') } })");
  assert!(conv::<u8>(scope, x, &d).is_err(), "throwing valueOf");
}

#[test]
fn floats() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = num(scope, 3.0);
  assert_eq!(conv::<f32>(scope, x, &Default::default()).unwrap(), 3.0);
  for v in [f64::INFINITY, f64::NAN, f64::MAX, 1e40] {
    let x = num(scope, v);
    assert!(conv::<f32>(scope, x, &Default::default()).is_err(), "f32 {v}");
  }
  let x = num(scope, f64::MAX);
  assert_eq!(conv::<f64>(scope, x, &Default::default()).unwrap(), f64::MAX);
  for v in [f64::INFINITY, -f64::INFINITY, f64::NAN] {
    let x = num(scope, v);
    assert!(conv::<f64>(scope, x, &Default::default()).is_err(), "f64 {v}");
  }
  let x = js(scope, "'2.5'");
  assert_eq!(conv::<f64>(scope, x, &Default::default()).unwrap(), 2.5);
}

#[test]
fn unrestricted() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = num(scope, 3.0);
  assert_eq!(*conv::<UnrestrictedFloat>(scope, x, &Default::default()).unwrap(), 3.0);
  let x = num(scope, f64::INFINITY);
  assert_eq!(*conv::<UnrestrictedFloat>(scope, x, &Default::default()).unwrap(), f32::INFINITY);
  let x = num(scope, f64::NAN);
  assert!(conv::<UnrestrictedFloat>(scope, x, &Default::default()).unwrap().is_nan());
  let x = num(scope, f64::MAX);
  assert!(conv::<UnrestrictedFloat>(scope, x, &Default::default()).unwrap().is_infinite());
  let x = num(scope, f64::INFINITY);
  assert_eq!(*conv::<UnrestrictedDouble>(scope, x, &Default::default()).unwrap(), f64::INFINITY);
  let x = num(scope, f64::NAN);
  assert!(conv::<UnrestrictedDouble>(scope, x, &Default::default()).unwrap().is_nan());
  let x = num(scope, f64::MAX);
  assert_eq!(*conv::<UnrestrictedDouble>(scope, x, &Default::default()).unwrap(), f64::MAX);
}

#[test]
fn booleans() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  for (src, want) in [("0", false), ("''", false), ("null", false), ("undefined", false), ("NaN", false),
                      ("'a'", true), ("({})", true), ("1", true), ("Symbol()", true)] {
    let x = js(scope, src);
    assert_eq!(conv::<bool>(scope, x, &Default::default()).unwrap(), want, "bool {src}");
  }
}

#[test]
fn strings() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = StringOptions::default();
  let n = StringOptions { treat_null_as_empty_string: true };
  for (src, want) in [("'foo'", "foo"), ("1", "1"), ("null", "null"), ("({})", "[object Object]"), ("'生'", "生"), ("'😀'", "😀")] {
    let x = js(scope, src);
    assert_eq!(conv::<String>(scope, x, &d).unwrap(), want, "string {src}");
  }
  let x = js(scope, "null");
  assert_eq!(conv::<String>(scope, x, &n).unwrap(), "");
  let x = js(scope, "({})");
  assert_eq!(conv::<String>(scope, x, &n).unwrap(), "[object Object]");
  let x = js(scope, "Symbol()");
  assert!(conv::<String>(scope, x, &d).is_err());
}

#[test]
fn byte_strings() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = StringOptions::default();
  let x = js(scope, "'foo'");
  assert_eq!(&*conv::<ByteString>(scope, x, &d).unwrap().0, "foo");
  let x = js(scope, "1");
  assert_eq!(&*conv::<ByteString>(scope, x, &d).unwrap().0, "1");
  let x = js(scope, "'\\u00ff'");
  assert_eq!(&*conv::<ByteString>(scope, x, &d).unwrap().0, "\u{ff}");
  let x = js(scope, "'生'");
  assert!(conv::<ByteString>(scope, x, &d).is_err());
  let x = js(scope, "'\\u0100'");
  assert!(conv::<ByteString>(scope, x, &d).is_err());
  let x = js(scope, "Symbol()");
  assert!(conv::<ByteString>(scope, x, &d).is_err());
}

#[test]
fn big_ints() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = js(scope, "5n");
  let b = conv::<BigInt>(scope, x, &Default::default()).unwrap();
  assert!(!b.sign);
  assert_eq!(b.words, vec![5]);
  let x = js(scope, "-(2n ** 64n + 3n)");
  let b = conv::<BigInt>(scope, x, &Default::default()).unwrap();
  assert!(b.sign);
  assert_eq!(b.words, vec![3, 1]);
}

#[test]
fn any_value() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = js(scope, "({})");
  assert!(conv::<v8::Local<v8::Value>>(scope, x, &Default::default()).unwrap().is_object());
}

#[test]
fn sequences() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = IntOptions::default();
  let x = js(scope, "[1, '2']");
  assert_eq!(conv::<Vec<u8>>(scope, x, &d).unwrap(), vec![1, 2]);
  let x = js(scope, "new Set([3, 4])");
  assert_eq!(conv::<Vec<u8>>(scope, x, &d).unwrap(), vec![3, 4]);
  let x = js(scope, "(function*() { yield 5; yield 6; })()");
  assert_eq!(conv::<Vec<u8>>(scope, x, &d).unwrap(), vec![5, 6]);
  let x = js(scope, "[300]");
  assert_eq!(conv::<Vec<u8>>(scope, x, &int(true, false)).unwrap(), vec![255]);
  let x = js(scope, "[]");
  assert_eq!(conv::<Vec<u8>>(scope, x, &d).unwrap(), Vec::<u8>::new());
  for src in ["'abc'", "1", "undefined", "({})"] {
    let x = js(scope, src);
    assert!(conv::<Vec<u8>>(scope, x, &d).is_err(), "sequence {src}");
  }
  let x = js(scope, "[[1], [2, 3]]");
  assert_eq!(conv::<Vec<Vec<u8>>>(scope, x, &d).unwrap(), vec![vec![1], vec![2, 3]]);
}

#[test]
fn nullables() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = IntOptions::default();
  let x = js(scope, "undefined");
  assert_eq!(conv::<Option<u8>>(scope, x, &d).unwrap(), None);
  let x = js(scope, "null");
  assert_eq!(conv::<Option<u8>>(scope, x, &d).unwrap(), None);
  let x = js(scope, "1");
  assert_eq!(conv::<Option<u8>>(scope, x, &d).unwrap(), Some(1));
  let x = js(scope, "300");
  assert_eq!(conv::<Option<u8>>(scope, x, &int(true, false)).unwrap(), Some(255));
}

#[test]
fn records() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let d = IntOptions::default();
  let x = js(scope, "({ foo: 1, bar: '2' })");
  assert_eq!(
    conv::<HashMap<String, u8>>(scope, x, &d).unwrap(),
    HashMap::from([("foo".to_string(), 1), ("bar".to_string(), 2)])
  );
  let x = js(scope, "Object.defineProperty({ a: 2 }, 'hidden', { value: 3, enumerable: false })");
  assert_eq!(conv::<HashMap<String, u8>>(scope, x, &d).unwrap(), HashMap::from([("a".to_string(), 2)]));
  let x = js(scope, "1");
  assert!(conv::<HashMap<String, u8>>(scope, x, &d).is_err());
}

#[derive(crate::WebIDL, Debug, Eq, PartialEq)]
#[webidl(dictionary)]
pub struct Dict {
  a: u8,
  #[options(clamp = true)]
  b: Vec<u16>,
  #[webidl(default = Some(3))]
  c: Option<u32>,
  #[webidl(rename = "e")]
  d: u16,
  f: HashMap<String, u32>,
  #[webidl(required)]
  g: Option<u32>,
  foo_bar: Option<u8>,
}

#[derive(crate::WebIDL, Debug, PartialEq)]
#[webidl(dictionary)]
pub struct AllOptional {
  #[webidl(default = 10)]
  limit: u32,
  name: Option<String>,
  #[webidl(default = true)]
  enabled: bool,
}

#[test]
fn dictionaries() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = js(scope, "({ a: 1, b: [70000], e: 70000, f: { foo: 1 }, g: 5, fooBar: 9, foo_bar: 1 })");
  assert_eq!(
    conv::<Dict>(scope, x, &Default::default()).unwrap(),
    Dict { a: 1, b: vec![65535], c: Some(3), d: 4464, f: HashMap::from([("foo".to_string(), 1)]), g: Some(5), foo_bar: Some(9) }
  );
  // a missing required member, and a missing member with no default, are errors
  let x = js(scope, "({ a: 1, b: [], e: 1, f: {} })");
  let err = conv::<Dict>(scope, x, &Default::default()).unwrap_err();
  assert!(err.to_string().contains("'g'") || err.to_string().contains("\"g\"") || err.to_string().contains(" g "), "error names the key: {err}");
  let x = js(scope, "({ b: [], e: 1, f: {}, g: 1 })");
  assert!(conv::<Dict>(scope, x, &Default::default()).is_err());
  // a member's own conversion error propagates
  let x = js(scope, "({ a: 1, b: 5, e: 1, f: {}, g: 1 })");
  assert!(conv::<Dict>(scope, x, &Default::default()).is_err());
  // non-objects
  for src in ["1", "'x'", "true"] {
    let x = js(scope, src);
    assert!(conv::<Dict>(scope, x, &Default::default()).is_err(), "dict {src}");
  }
}

#[test]
fn dictionary_defaults() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let want = AllOptional { limit: 10, name: None, enabled: true };
  for src in ["undefined", "null", "({})", "({ limit: undefined })"] {
    let x = js(scope, src);
    assert_eq!(conv::<AllOptional>(scope, x, &Default::default()).unwrap(), want, "defaults {src}");
  }
  let x = js(scope, "({ limit: 2, name: 'n', enabled: false })");
  assert_eq!(
    conv::<AllOptional>(scope, x, &Default::default()).unwrap(),
    AllOptional { limit: 2, name: Some("n".into()), enabled: false }
  );
  let x = js(scope, "Object.assign(Object.create({ limit: 4 }), {})");
  assert_eq!(conv::<AllOptional>(scope, x, &Default::default()).unwrap().limit, 4, "inherited members count");
}

#[test]
fn dictionary_member_order() {
  #[derive(crate::WebIDL, Debug)]
  #[webidl(dictionary)]
  pub struct Ordered {
    zeta: Option<u8>,
    alpha: Option<u8>,
    #[webidl(rename = "middle")]
    m: Option<u8>,
  }
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = js(scope, "globalThis.seen = []; ({ get zeta() { seen.push('zeta'); return 1 }, get alpha() { seen.push('alpha'); return 1 }, get middle() { seen.push('middle'); return 1 } })");
  conv::<Ordered>(scope, x, &Default::default()).unwrap();
  let seen = js(scope, "seen.join(',')");
  assert_eq!(seen.to_rust_string_lossy(scope), "alpha,middle,zeta");
}

#[derive(crate::WebIDL, Debug, Eq, PartialEq)]
#[webidl(enum)]
pub enum Enumeration {
  FooBar,
  Baz,
  #[webidl(rename = "hello")]
  World,
}

#[test]
fn enums() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  for (src, want) in [("'foo-bar'", Enumeration::FooBar), ("'baz'", Enumeration::Baz), ("'hello'", Enumeration::World),
                      ("({ toString() { return 'baz' } })", Enumeration::Baz)] {
    let x = js(scope, src);
    assert_eq!(conv::<Enumeration>(scope, x, &Default::default()).unwrap(), want, "enum {src}");
  }
  for src in ["'unknown'", "'FooBar'", "'world'", "'Baz'", "undefined"] {
    let x = js(scope, src);
    assert!(conv::<Enumeration>(scope, x, &Default::default()).is_err(), "enum {src}");
  }
}

#[test]
fn errors_display_prefix_and_context() {
  let mut runtime = JsRuntime::new(Default::default());
  let scope = &mut runtime.handle_scope();
  let x = js(scope, "Symbol()");
  let err = <u8 as WebIdlConverter>::convert(scope, x, "Failed to execute 'f'".into(), || "Argument 1".into(), &Default::default()).unwrap_err();
  let msg = err.to_string();
  assert!(msg.starts_with("Failed to execute 'f'"), "{msg}");
  assert!(msg.contains("Argument 1"), "{msg}");
  let _: &dyn std::error::Error = &err;
}

#[crate::op2]
fn op_zz_webidl_dict(#[webidl] d: AllOptional) -> u32 {
  d.limit + if d.enabled { 1000 } else { 0 }
}

#[crate::op2]
#[string]
fn op_zz_webidl_enum(#[webidl] e: Enumeration) -> String {
  format!("{e:?}")
}

#[crate::op2]
fn op_zz_webidl_seq(#[webidl] v: Vec<u8>) -> u32 {
  v.iter().map(|x| *x as u32).sum()
}

#[test]
fn op2_webidl_arguments() {
  crate::extension!(zz_webidl_ext, ops = [op_zz_webidl_dict, op_zz_webidl_enum, op_zz_webidl_seq]);
  let mut runtime = JsRuntime::new(crate::RuntimeOptions {
    extensions: vec![zz_webidl_ext::init_ops()],
    ..Default::default()
  });
  let out = runtime
    .execute_script(
      "zz.js",
      r#"
      const { op_zz_webidl_dict, op_zz_webidl_enum, op_zz_webidl_seq } = Deno.core.ops;
      const results = [
        op_zz_webidl_dict({ limit: 5 }),
        op_zz_webidl_dict(undefined),
        op_zz_webidl_dict({ enabled: false, limit: 1 }),
        op_zz_webidl_enum("foo-bar"),
        op_zz_webidl_seq(new Set([1, 2, 3])),
      ];
      for (const bad of [() => op_zz_webidl_enum("nope"), () => op_zz_webidl_dict(1), () => op_zz_webidl_seq(5)]) {
        try { bad(); results.push("no error"); } catch (e) { results.push(e instanceof TypeError ? "TypeError" : String(e)); }
      }
      results.join(",")
      "#,
    )
    .unwrap();
  let scope = &mut runtime.handle_scope();
  let out = v8::Local::new(scope, out);
  assert_eq!(
    out.to_rust_string_lossy(scope),
    "1005,1010,1,FooBar,6,TypeError,TypeError,TypeError"
  );
}
