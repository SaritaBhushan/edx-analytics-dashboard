/**
 * A view which renders a select box in order to filter a Learners Collection.
 *
 * It takes a collection, a display name, a filter field, and a set of possible
 * filter values.
 */
define(function(require) {
    'use strict';

    var $ = require('jquery'),
        _ = require('underscore'),
        Marionette = require('marionette'),

        Utils = require('utils/utils'),
        filterTemplate = require('text!learners/roster/templates/filter.underscore'),

        Filter;

    Filter = Marionette.ItemView.extend({
        events: function() {
            var changeFilterEvent = 'change #filter-' + this.options.filterKey,
                eventsHash = {};
            eventsHash[changeFilterEvent] = 'onFilter';
            return eventsHash;
        },

        // It is assumed that there can never be a filter with an empty
        // name, therefore it's safe to use the empty string as a
        // property in this object.  The API interprets this as "all
        // items, unfiltered".
        catchAllFilterValue: '',

        className: 'list-filter',

        template: _.template(filterTemplate),

        /**
         * Initialize a filter.
         *
         * @param options an options object which must include the following
         * key/values:
         *      - collection: the collection to filter.
         *      - filterKey (string): the field to be filtered by on the collection.
         *      - filterValues (Object): the set of valid values that the
         *        filterKey can take on, represented as a mapping from
         *        filter values to the number of items matching the applied
         *        filter.
         *      - selectDisplayName (string): a *translated* string that will
         *        appear as the label for this filter.
         *      - trackingModel (Object): tracking model for broadcasting filter
         *        events.
         */
        initialize: function(options) {
            this.options = options || {};
            _.bind(this.onSelectFilter, this);
            this.listenTo(this.options.collection, 'sync', this.render);
        },

        templateHelpers: function() {
            // 'filterValues' is an array of objects, each having a 'name' key
            // and a 'displayName' key.  'name' is the name of the filter value
            // (e.g. the cohort name when filtering by cohort), while
            // 'displayName' is the user-facing representation of the filter
            // which combines the filter with the number of users belonging to
            // it.
            var filterValues,
                selectedFilterValue;
            filterValues = _.chain(this.options.filterValues)
                .pairs()
                .map(function(filterPair) {
                    var name = filterPair[0],
                        numResults = filterPair[1];
                    return {
                        name: name,
                        displayName: _.template(
                            // eslint-disable-next-line max-len
                            // Translators: 'name' here refers to the name of the filter, while 'numResults' refers to the number of items belonging to that filter.
                            gettext('<%= name %> (<%= numResults %>)')
                        )({
                            name: name,
                            numLearners: Utils.localizeNumber(numResults, 0)
                        })
                    };
                })
                .sortBy('name')
                .value();

            if (filterValues.length && this.options.filterInput === 'select') {
                filterValues.unshift({
                    name: this.catchAllFilterValue,
                    // Translators: "All" refers to viewing all the learners in a course.
                    displayName: gettext('All')
                });

                // FIXME: The following code isn't working correctly. getActiveFilterFields seems to return an object,
                // not an array.
                // Assumes that you can only filter by one filterKey at a time.
                selectedFilterValue = _.chain(filterValues)
                    .pluck('name')
                    .intersection(this.options.collection.getActiveFilterFields())
                    .first()
                    .value() || this.catchAllFilterValue;
                _.findWhere(filterValues, {name: selectedFilterValue}).selected = true;
            }
            return {
                filterKey: this.options.filterKey,
                filterValues: filterValues,
                selectDisplayName: this.options.selectDisplayName
            };
        },

        onCheckboxFilter: function(event) {
            var $inputs = $(event.currentTarget).find('input:checkbox:checked'),
                filterKey = $(event.currentTarget).attr('id').slice(7), // chop off "filter-" prefix
                appliedFilters = [],
                filterValue = '';
            if ($inputs.length) {
                _.each($inputs, _.bind(function(input) {
                    appliedFilters.push($(input).attr('id'));
                }, this));
                filterValue = appliedFilters.join(',');
                this.collection.setFilterField(filterKey, filterValue);
            } else {
                this.collection.unsetFilterField(filterKey);
            }
            this.collection.refresh();
            $('#app-focusable').focus();
            this.options.trackingModel.trigger('segment:track', 'edx.bi.list.filtered', {
                category: filterValue
            });
        },

        onSelectFilter: function(event) {
            // Sends a request to the server for the filtered learner list.
            var selectedOption = $(event.currentTarget).find('option:selected'),
                selectedFilterValue = selectedOption.val(),
                filterWasUnset = selectedFilterValue === this.catchAllFilterValue;
            event.preventDefault();
            if (this.options.filterKey === 'segments') {
                selectedFilterValue = 'inactive';
            }
            if (filterWasUnset) {
                this.collection.unsetFilterField(this.options.filterKey);
            } else {
                this.collection.setFilterField(this.options.filterKey, selectedFilterValue);
            }
            this.collection.refresh();
            $('#app-focusable').focus();
            this.options.trackingModel.trigger('segment:track', 'edx.bi.roster.filtered', {
                category: this.options.filterKey
            });
        },

        onFilter: function(event) {
            if ($(event.currentTarget).find('option').length) {
                this.onSelectFilter(event);
            } else if ($(event.currentTarget).find('input:checkbox').length) {
                this.onCheckboxFilter(event);
            }
        }
    });

    return Filter;
});