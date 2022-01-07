import {
  ASCII_BACKSLASH,
  IS_ATOM_CHAR
} from './formal-syntax'

/**
 * Compiles an input object into
 */
export default function (response, asArray, isLogging) {
  let respParts = []
  let resp = (response.tag || '') + (response.command ? ' ' + response.command : '')
  let needsSpace = true

  let walk = function (node) {
    if (resp.length > 0 && needsSpace) {
      resp += ' '
    }

    if (Array.isArray(node)) {
      needsSpace = false
      resp += '('
      node.forEach(walk)
      resp += ')'
      return
    } else {
      needsSpace = true
    }

    if (!node && typeof node !== 'string' && typeof node !== 'number') {
      resp += 'NIL'
      return
    }

    if (typeof node === 'string') {
      if (isLogging && node.length > 20) {
        resp += '"(* ' + node.length + 'B string *)"'
      } else {
        resp += JSON.stringify(node)
      }
      return
    }

    if (typeof node === 'number') {
      resp += Math.round(node) || 0 // Only integers allowed
      return
    }

    if (isLogging && node.sensitive) {
      resp += '"(* value hidden *)"'
      return
    }

    switch (node.type.toUpperCase()) {
      case 'LITERAL':
        if (isLogging) {
          resp += '"(* ' + node.value.length + 'B literal *)"'
        } else {
          if (!node.value) {
            resp += '{0}\r\n'
          } else {
            resp += '{' + node.value.length + '}\r\n'
          }
          respParts.push(resp)
          resp = node.value || ''
        }
        break

      case 'STRING':
        if (isLogging && node.value.length > 20) {
          resp += '"(* ' + node.value.length + 'B string *)"'
        } else {
          resp += JSON.stringify(node.value || '')
        }
        break
      case 'TEXT':
      case 'SEQUENCE':
        resp += node.value || ''
        break

      case 'NUMBER':
        resp += (node.value || 0)
        break

      case 'ATOM':
      case 'SECTION':
        let val = node.value || ''

        for (let i = val.charCodeAt(0) === ASCII_BACKSLASH ? 1 : 0; i < val.length; i++) {
          if (!IS_ATOM_CHAR(val.charCodeAt(i))) {
            val = JSON.stringify(val)
            break
          }
        }

        resp += val

        if (node.section) {
          resp += '['
          if (node.section.length) {
            needsSpace = false
            node.section.forEach(walk)
          }
          resp += ']'
        }
        if (node.partial) {
          resp += '<' + node.partial.join('.') + '>'
        }
        break
    }
  };

  [].concat(response.attributes || []).forEach(walk)

  if (resp.length) {
    respParts.push(resp)
  }

  return asArray ? respParts : respParts.join('')
};
