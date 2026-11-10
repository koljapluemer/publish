-- Pandoc filter applied to the document body before it is handed to Typst.
--   * Shifts headings so the shallowest one is level 1. Notes that start at "##"
--     would otherwise get section numbers like "0.1".
--   * Rewrites relative image paths to project-root paths (see pdf.py).

local function is_remote(src)
  return src:match("^%a[%w+.-]*:") ~= nil
end

local function percent_decode(src)
  return (src:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end))
end

function Pandoc(doc)
  local shallowest = math.huge
  doc:walk({
    Header = function(h)
      shallowest = math.min(shallowest, h.level)
    end,
  })
  local shift = shallowest == math.huge and 0 or shallowest - 1
  local doc_dir = pandoc.utils.stringify(doc.meta["doc-dir"] or "")

  return doc:walk({
    Header = function(h)
      h.level = h.level - shift
      return h
    end,
    Image = function(img)
      if not is_remote(img.src) then
        local src = percent_decode(img.src)
        if src:sub(1, 1) ~= "/" then
          src = doc_dir .. "/" .. src
        end
        img.src = src
      end
      return img
    end,
  })
end
