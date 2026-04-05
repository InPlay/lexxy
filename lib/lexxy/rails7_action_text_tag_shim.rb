# frozen_string_literal: true

# ActionView::Helpers::Tags::ActionText was added in Rails 8.
# Lexxy prepends its own render logic onto this class, so the stub body is never called.
module ActionView
  module Helpers
    module Tags
      class ActionText < Base
        def render
          raise NotImplementedError, "Replaced by Lexxy — this should never be called"
        end
      end
    end
  end
end
